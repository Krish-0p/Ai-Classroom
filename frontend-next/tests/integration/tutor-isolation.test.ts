import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db/client";
import type { Actor } from "@/features/auth/schema";
import { PgVectorRetrieval } from "@/ai/rag/retrieval";
import { sourceFingerprint } from "@/ai/rag/chunking";
import { readTutor } from "@/server/tutor";
import { readAnalytics } from "@/server/analytics";
const db = getDatabase();
const users: string[] = [],
  classrooms: string[] = [];
const vector = [1, ...Array<number>(767).fill(0)];
let teacher: Actor, outsider: Actor, student: Actor, peer: Actor;
let approvedSource: string;
const model = "test-only-embedding-model";
beforeAll(async () => {
  const actors: Actor[] = [];
  for (const role of ["teacher", "teacher", "student", "student"] as const) {
    const id = randomUUID();
    users.push(id);
    await db.user.create({
      data: { id, role, name: "Isolation fixture", email: `${id}@example.com` },
    });
    actors.push({ id, role, name: "Isolation fixture" });
  }
  [teacher, outsider, student, peer] = actors;
  for (const owner of [teacher, outsider]) {
    const classroom = await db.classroom.create({
      data: {
        teacherId: owner.id,
        name: "Tutor isolation",
        academicLevel: "University",
        durationWeeks: 12,
        joinCode: randomUUID(),
      },
    });
    classrooms.push(classroom.id);
  }
  await db.enrollment.createMany({
    data: [
      { classroomId: classrooms[0], studentId: student.id },
      { classroomId: classrooms[0], studentId: peer.id },
    ],
  });
  for (const [index, classroomId] of [
    classrooms[0],
    classrooms[0],
    classrooms[1],
  ].entries()) {
    const contentHash = `fixture-${index}`;
    const source = await db.sourceDocument.create({
      data: {
        classroomId,
        uploadedBy: teacher.id,
        filename: `Source ${index}`,
        mimeType: "text/plain",
        storageKey: randomUUID(),
        contentHash,
        extractedText: "Queue evidence",
        metadata: {},
      },
    });
    const sourceIndex = await db.sourceIndex.create({
      data: {
        classroomId,
        sourceId: source.id,
        fingerprint: sourceFingerprint(contentHash, model),
        model,
        ready: true,
      },
    });
    const chunk = await db.sourceChunk.create({
      data: {
        indexId: sourceIndex.id,
        ordinal: 0,
        label: "Section 1",
        text: `Evidence ${index}`,
      },
    });
    await db.$executeRaw`UPDATE "SourceChunk" SET embedding=${JSON.stringify(vector)}::vector WHERE id=${chunk.id}`;
    if (index !== 1) {
      await db.curriculum.create({
        data: {
          classroomId,
          sourceIds: [source.id],
          approvedSourceIds: [source.id],
          approvedVersion: 1,
        },
      });
      if (index === 0) approvedSource = source.id;
    }
  }
  for (const actor of [student, peer]) {
    await db.tutorConversation.create({
      data: {
        classroomId: classrooms[0],
        userId: actor.id,
        messages: {
          create: {
            requestId: randomUUID(),
            question: `Private ${actor.id}`,
            status: "complete",
            answer: "Source-backed answer",
            citations: [
              {
                id: "fixture",
                sourceId: approvedSource,
                filename: "Source",
                label: "Section 1",
                text: "Queue evidence",
              },
            ],
          },
        },
      },
    });
  }
});
afterAll(async () => {
  await db.classroom.deleteMany({ where: { id: { in: classrooms } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});
describe("classroom-isolated retrieval and analytics (no provider calls)", () => {
  it("retrieves only currently approved chunks in the authorized classroom", async () => {
    const store = new PgVectorRetrieval();
    const results = await store.retrieve(
      db,
      student,
      classrooms[0],
      model,
      vector,
    );
    expect(results.map((row) => row.sourceId)).toEqual([approvedSource]);
    expect(
      await store.retrieve(db, student, classrooms[1], model, vector),
    ).toEqual([]);
    expect(
      await store.retrieve(db, outsider, classrooms[0], model, vector),
    ).toEqual([]);
  });
  it("keeps peer conversations private and denies student/foreign-teacher analytics", async () => {
    const result = await readTutor(student, classrooms[0]);
    expect(result.messages.map((message) => message.question)).toEqual([
      `Private ${student.id}`,
    ]);
    await expect(readAnalytics(student, classrooms[0])).rejects.toMatchObject({
      status: 403,
    });
    await expect(readAnalytics(outsider, classrooms[0])).rejects.toMatchObject({
      status: 404,
    });
  });
  it("revokes retrieval and historical citation content immediately on unapproval", async () => {
    await db.curriculum.update({
      where: { classroomId: classrooms[0] },
      data: { approvedSourceIds: [] },
    });
    expect(
      await new PgVectorRetrieval().retrieve(
        db,
        student,
        classrooms[0],
        model,
        vector,
      ),
    ).toEqual([]);
    const result = await readTutor(student, classrooms[0]);
    expect(result.messages[0].citations).toEqual([]);
    expect(result.messages[0].answer).not.toBe("Source-backed answer");
  });
});
