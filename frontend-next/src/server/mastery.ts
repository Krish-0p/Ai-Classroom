import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/db/client";
import {
  WeightedMasteryStrategy,
  type MasteryEvidence,
} from "@/features/mastery/strategy";
import type { Actor } from "@/features/auth/schema";
import { readClassroom } from "@/server/classrooms";
import { AppError } from "@/server/errors";
import { messages } from "@/lib/messages";
const strategy = new WeightedMasteryStrategy();
export async function masteryEvidence(
  db: Prisma.TransactionClient,
  classroomId: string,
  studentId: string,
  conceptIds?: string[],
) {
  const rows = await db.questionAttempt.findMany({
    where: {
      needsReview: false,
      marks: { not: null },
      ...(conceptIds ? { conceptIds: { hasSome: conceptIds } } : {}),
      attempt: {
        studentId,
        submittedAt: { not: null },
        assessment: { classroomId },
      },
    },
    select: {
      questionKey: true,
      conceptIds: true,
      marks: true,
      maximumMarks: true,
      difficulty: true,
      hintsUsed: true,
      attempt: {
        select: { assessmentId: true, number: true, submittedAt: true },
      },
    },
  });
  const evidence = new Map<string, MasteryEvidence[]>();
  for (const row of rows)
    for (const conceptId of row.conceptIds) {
      if (conceptIds && !conceptIds.includes(conceptId)) continue;
      const items = evidence.get(conceptId) ?? [];
      items.push({
        accuracy: row.marks! / row.maximumMarks,
        difficulty: row.difficulty,
        hintsUsed: row.hintsUsed,
        attemptNumber: row.attempt.number,
        questionIdentity: `${row.attempt.assessmentId}:${row.questionKey}`,
        observedAt: row.attempt.submittedAt!,
      });
      evidence.set(conceptId, items);
    }
  return evidence;
}
export async function updateMastery(
  db: Prisma.TransactionClient,
  classroomId: string,
  studentId: string,
  conceptIds: string[],
) {
  const evidence = await masteryEvidence(
    db,
    classroomId,
    studentId,
    conceptIds,
  );
  for (const conceptId of [...new Set(conceptIds)]) {
    const estimate = strategy.evaluate(evidence.get(conceptId) ?? []);
    const data = {
      classroomId,
      masteryScore: estimate.score,
      confidence: estimate.confidence,
      evidenceCount: estimate.evidenceCount,
      explanation: estimate.explanation,
    };
    await db.masteryRecord.upsert({
      where: { studentId_conceptId: { studentId, conceptId } },
      create: { ...data, studentId, conceptId },
      update: data,
    });
  }
}
export async function readProgress(actor: Actor, classroomId: string) {
  if (actor.role !== "student") throw new AppError(403, messages.forbidden);
  await readClassroom(actor, classroomId);
  const db = getDatabase();
  const [concepts, evidence, attempts] = await Promise.all([
    db.concept.findMany({
      where: {
        classroomId,
        classroom: { enrollments: { some: { studentId: actor.id } } },
      },
      select: {
        id: true,
        title: true,
        unit: { select: { title: true } },
        lessons: {
          where: { status: "published" },
          select: { id: true, title: true, published: true },
          take: 1,
        },
      },
      orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
    }),
    masteryEvidence(db, classroomId, actor.id),
    db.attempt.findMany({
      where: {
        studentId: actor.id,
        submittedAt: { not: null },
        assessment: {
          classroomId,
          classroom: { enrollments: { some: { studentId: actor.id } } },
        },
      },
      select: {
        id: true,
        number: true,
        score: true,
        maximumScore: true,
        pendingReview: true,
        submittedAt: true,
        assessmentId: true,
      },
      orderBy: { submittedAt: "desc" },
      take: 20,
    }),
  ]);
  return {
    concepts: concepts.map((concept) => ({
      id: concept.id,
      title: concept.title,
      unit: concept.unit.title,
      lessonId: concept.lessons[0]?.id ?? null,
      ...strategy.evaluate(evidence.get(concept.id) ?? []),
    })),
    attempts,
  };
}
