import "server-only";
import {
  Prisma,
  type Assessment,
  type Question,
} from "@/generated/prisma/client";
import type { Actor } from "@/features/auth/schema";
import {
  assessmentSchema,
  publishedAssessmentSchema,
  publicQuestion,
  type AssessmentInput,
} from "@/features/assessments/schema";
import { getDatabase } from "@/db/client";
import { readClassroom } from "@/server/classrooms";
import { lockOwnedClassroom } from "@/server/curriculum-access";
import { AppError } from "@/server/errors";
import { assessmentMessages as m } from "@/lib/assessment-messages";
export function assessmentDocument(
  row: Pick<
    Assessment,
    "title" | "instructions" | "maxAttempts" | "showSolutions"
  > & { questions: Pick<Question, "content">[] },
) {
  return assessmentSchema.parse({
    ...{
      title: row.title,
      instructions: row.instructions,
      maxAttempts: row.maxAttempts,
      showSolutions: row.showSolutions,
    },
    questions: row.questions.map((q) => q.content),
  });
}
export async function validateQuestionConcepts(
  db: Prisma.TransactionClient,
  classroomId: string,
  document: AssessmentInput,
) {
  const ids = [...new Set(document.questions.flatMap((q) => q.conceptIds))];
  if (
    (await db.concept.count({ where: { id: { in: ids }, classroomId } })) !==
    ids.length
  )
    throw new AppError(400, m.selectConcepts);
}
export async function writeQuestions(
  db: Prisma.TransactionClient,
  assessmentId: string,
  document: AssessmentInput,
) {
  await db.question.deleteMany({ where: { assessmentId } });
  for (const [order, q] of document.questions.entries())
    await db.question.create({
      data: {
        assessmentId,
        key: q.id,
        type: q.type,
        order,
        content: q,
        concepts: { create: q.conceptIds.map((conceptId) => ({ conceptId })) },
      },
    });
}
export async function listAssessments(actor: Actor, classroomId: string) {
  await readClassroom(actor, classroomId);
  if (actor.role === "teacher")
    return getDatabase().assessment.findMany({
      where: { classroomId, classroom: { teacherId: actor.id } },
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        publishedVersion: true,
      },
      orderBy: { createdAt: "desc" },
    });
  const rows = await getDatabase().assessment.findMany({
    where: {
      classroomId,
      status: "published",
      published: { not: Prisma.DbNull },
      classroom: { enrollments: { some: { studentId: actor.id } } },
    },
    select: { id: true, published: true, publishedVersion: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    title: publishedAssessmentSchema.parse(row.published).title,
    status: "published" as const,
    version: row.publishedVersion,
    publishedVersion: row.publishedVersion,
  }));
}
export async function createAssessment(
  actor: Actor,
  classroomId: string,
  title: string,
) {
  return getDatabase().$transaction(async (db) => {
    await lockOwnedClassroom(db, actor, classroomId);
    if ((await db.assessment.count({ where: { classroomId } })) >= 100)
      throw new AppError(413, m.questionLimit);
    return db.assessment.create({
      data: { classroomId, title },
      select: { id: true },
    });
  });
}
export async function readAssessment(
  actor: Actor,
  classroomId: string,
  id: string,
) {
  await readClassroom(actor, classroomId);
  const db = getDatabase();
  if (actor.role === "student") {
    const row = await db.assessment.findFirst({
      where: {
        id,
        classroomId,
        status: "published",
        published: { not: Prisma.DbNull },
        classroom: { enrollments: { some: { studentId: actor.id } } },
      },
      select: { id: true, published: true, publishedVersion: true },
    });
    if (!row) throw new AppError(404, m.notFound);
    const document = publishedAssessmentSchema.parse(row.published);
    const attempts = await db.attempt.findMany({
      where: { assessmentId: id, studentId: actor.id },
      select: {
        id: true,
        number: true,
        submittedAt: true,
        score: true,
        maximumScore: true,
        pendingReview: true,
      },
      orderBy: { number: "desc" },
    });
    return {
      kind: "student" as const,
      id: row.id,
      title: document.title,
      instructions: document.instructions,
      maxAttempts: document.maxAttempts,
      questionCount: document.questions.length,
      attempts,
    };
  }
  const row = await db.assessment.findFirst({
    where: { id, classroomId, classroom: { teacherId: actor.id } },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!row) throw new AppError(404, m.notFound);
  const job = await db.generationJob.findFirst({
    where: { assessmentId: id, classroomId },
    select: { id: true, status: true, progress: true, error: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    kind: "teacher" as const,
    id: row.id,
    document: assessmentDocument(row),
    version: row.version,
    status: row.status,
    publishedVersion: row.publishedVersion,
    preview: assessmentDocument(row).questions.map(publicQuestion),
    job,
  };
}
export async function saveAssessment(
  actor: Actor,
  classroomId: string,
  id: string,
  version: number,
  input: AssessmentInput,
) {
  const document = assessmentSchema.parse(input);
  return getDatabase().$transaction(
    async (db) => {
      await lockOwnedClassroom(db, actor, classroomId);
      const row = await db.assessment.findFirst({
        where: { id, classroomId, classroom: { teacherId: actor.id } },
      });
      if (!row) throw new AppError(404, m.notFound);
      if (row.version !== version) throw new AppError(409, m.conflict);
      await validateQuestionConcepts(db, classroomId, document);
      await writeQuestions(db, id, document);
      return db.assessment.update({
        where: { id },
        data: {
          title: document.title,
          instructions: document.instructions,
          maxAttempts: document.maxAttempts,
          showSolutions: document.showSolutions,
          version: { increment: 1 },
        },
        select: { version: true },
      });
    },
    { timeout: 15_000 },
  );
}
export async function assessmentStatus(
  actor: Actor,
  classroomId: string,
  id: string,
  version: number,
  action: "publish" | "unpublish" | "archive",
) {
  return getDatabase().$transaction(async (db) => {
    await lockOwnedClassroom(db, actor, classroomId);
    const row = await db.assessment.findFirst({
      where: { id, classroomId, classroom: { teacherId: actor.id } },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!row) throw new AppError(404, m.notFound);
    if (row.version !== version) throw new AppError(409, m.conflict);
    if (action === "publish") {
      const parsed = publishedAssessmentSchema.safeParse(
        assessmentDocument(row),
      );
      if (!parsed.success)
        throw new AppError(400, parsed.error.issues[0].message);
      await validateQuestionConcepts(db, classroomId, parsed.data);
      await db.assessment.update({
        where: { id },
        data: {
          status: "published",
          published: parsed.data,
          version: { increment: 1 },
          publishedVersion: version + 1,
        },
      });
    } else
      await db.assessment.update({
        where: { id },
        data: {
          status: action === "archive" ? "archived" : "draft",
          version: { increment: 1 },
          published: Prisma.DbNull,
          publishedVersion: 0,
        },
      });
    return { version: version + 1 };
  });
}
