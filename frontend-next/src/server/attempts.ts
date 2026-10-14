import "server-only";
import type { Actor } from "@/features/auth/schema";
import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/db/client";
import {
  publishedAssessmentSchema,
  publicQuestion,
  type QuestionResponse,
} from "@/features/assessments/schema";
import { validResponse, gradeQuestion } from "@/features/assessments/grading";
import { readClassroom } from "@/server/classrooms";
import { lockOwnedClassroom, ownedClassroom } from "@/server/curriculum-access";
import { updateMastery } from "@/server/mastery";
import { validateQuestionConcepts } from "@/server/assessments";
import { recordLearningEvent } from "@/server/learning-events";
import { AppError } from "@/server/errors";
import { messages } from "@/lib/messages";
import { assessmentMessages as m } from "@/lib/assessment-messages";

async function lockStudent(
  db: Prisma.TransactionClient,
  actor: Actor,
  classroomId: string,
) {
  if (actor.role !== "student") throw new AppError(403, messages.forbidden);
  const classroom = await db.$queryRaw<
    { status: string }[]
  >`SELECT status FROM "Classroom" WHERE id=${classroomId} FOR SHARE`;
  const enrollment = await db.$queryRaw<
    { studentId: string }[]
  >`SELECT "studentId" FROM "Enrollment" WHERE "classroomId"=${classroomId} AND "studentId"=${actor.id} FOR UPDATE`;
  if (!enrollment.length || !classroom.length)
    throw new AppError(404, m.notFound);
  if (classroom[0].status !== "active") throw new AppError(409, m.readonly);
}
export async function startAttempt(
  actor: Actor,
  classroomId: string,
  assessmentId: string,
) {
  return getDatabase().$transaction(async (db) => {
    await lockStudent(db, actor, classroomId);
    const assessment = await db.assessment.findFirst({
      where: {
        id: assessmentId,
        classroomId,
        status: "published",
        published: { not: Prisma.DbNull },
      },
    });
    if (!assessment) throw new AppError(404, m.notFound);
    const document = publishedAssessmentSchema.parse(assessment.published);
    await validateQuestionConcepts(db, classroomId, document);
    const open = await db.attempt.findFirst({
      where: { assessmentId, studentId: actor.id, submittedAt: null },
      select: { id: true },
    });
    if (open) return open;
    const count = await db.attempt.count({
      where: { assessmentId, studentId: actor.id },
    });
    if (count >= document.maxAttempts) throw new AppError(409, m.attemptLimit);
    const created = await db.attempt.create({
      data: {
        assessmentId,
        studentId: actor.id,
        number: count + 1,
        assessmentVersion: assessment.publishedVersion,
        snapshot: document,
        maximumScore: document.questions.reduce((sum, q) => sum + q.marks, 0),
        questions: {
          create: document.questions.map((q) => ({
            questionKey: q.id,
            conceptIds: q.conceptIds,
            difficulty: q.difficulty,
            maximumMarks: q.marks,
          })),
        },
      },
      select: { id: true },
    });
    await recordLearningEvent(db, {
      classroomId,
      userId: actor.id,
      type: "activity_attempted",
      resourceId: created.id,
      dedupeKey: `activity_attempted:${created.id}`,
    });
    return created;
  });
}
export async function readAttempt(
  actor: Actor,
  classroomId: string,
  id: string,
) {
  await readClassroom(actor, classroomId);
  const row = await getDatabase().attempt.findFirst({
    where: {
      id,
      ...(actor.role === "student" ? { studentId: actor.id } : {}),
      assessment: {
        classroomId,
        classroom:
          actor.role === "teacher"
            ? { teacherId: actor.id }
            : { enrollments: { some: { studentId: actor.id } } },
      },
    },
    include: {
      questions: true,
      assessment: { select: { status: true } },
      student: { select: { name: true } },
    },
  });
  if (
    !row ||
    (actor.role === "student" &&
      !row.submittedAt &&
      row.assessment.status !== "published")
  )
    throw new AppError(404, m.notFound);
  const document = publishedAssessmentSchema.parse(row.snapshot);
  const show =
    actor.role === "teacher" || (!!row.submittedAt && document.showSolutions);
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    title: document.title,
    instructions: document.instructions,
    number: row.number,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    score: row.score,
    maximumScore: row.maximumScore,
    pendingReview: row.pendingReview,
    studentName: actor.role === "teacher" ? row.student.name : undefined,
    showSolutions: show,
    questions: document.questions.map((q) => {
      const answer = row.questions.find((item) => item.questionKey === q.id)!;
      return {
        ...publicQuestion(q),
        response: (answer.response ?? "") as QuestionResponse,
        hintsUsed: answer.hintsUsed,
        hint: answer.hintsUsed ? q.hint : undefined,
        marksAwarded: row.submittedAt ? answer.marks : null,
        needsReview: row.submittedAt ? answer.needsReview : false,
        feedback: row.submittedAt ? answer.feedback : "",
        solution: show
          ? {
              answerIds: q.answerIds,
              numericAnswer: q.numericAnswer,
              tolerance: q.tolerance,
              explanation: q.explanation,
            }
          : undefined,
      };
    }),
  };
}
export type AttemptView = Awaited<ReturnType<typeof readAttempt>>;
async function activeAttempt(
  db: Prisma.TransactionClient,
  actor: Actor,
  classroomId: string,
  id: string,
) {
  const attempt = await db.attempt.findFirst({
    where: { id, studentId: actor.id, assessment: { classroomId } },
    include: { questions: true, assessment: { select: { status: true } } },
  });
  if (!attempt) throw new AppError(404, m.notFound);
  if (!attempt.submittedAt && attempt.assessment.status !== "published")
    throw new AppError(409, m.notFound);
  return attempt;
}
export async function saveOrSubmitAttempt(
  actor: Actor,
  classroomId: string,
  id: string,
  responses: { questionId: string; response: QuestionResponse }[],
  submit: boolean,
) {
  await getDatabase().$transaction(
    async (db) => {
      await lockStudent(db, actor, classroomId);
      const attempt = await activeAttempt(db, actor, classroomId, id);
      if (attempt.submittedAt) return; // Idempotent retries never create duplicate evidence.
      const document = publishedAssessmentSchema.parse(attempt.snapshot);
      const byId = new Map(
        responses.map((response) => [response.questionId, response.response]),
      );
      if (
        responses.some(
          (r) => !document.questions.some((q) => q.id === r.questionId),
        )
      )
        throw new AppError(400, m.invalidAnswer);
      let score = 0,
        pendingReview = false;
      for (const q of document.questions) {
        const previous = attempt.questions.find(
          (item) => item.questionKey === q.id,
        )!;
        const response =
          byId.get(q.id) ??
          (previous.response as QuestionResponse | null) ??
          "";
        if (!validResponse(q, response))
          throw new AppError(400, m.invalidAnswer);
        const grade = submit ? gradeQuestion(q, response) : undefined;
        if (grade) {
          score += grade.marks ?? 0;
          pendingReview ||= grade.needsReview;
        }
        await db.questionAttempt.update({
          where: { id: previous.id },
          data: { response, ...grade },
        });
      }
      if (submit) {
        await recordLearningEvent(db, {
          classroomId,
          userId: actor.id,
          type: "assessment_submitted",
          resourceId: id,
          dedupeKey: `assessment_submitted:${id}`,
        });
        await db.attempt.update({
          where: { id },
          data: {
            submittedAt: new Date(),
            score: Math.round(score * 100) / 100,
            pendingReview,
          },
        });
        await updateMastery(
          db,
          classroomId,
          actor.id,
          document.questions.flatMap((q) => q.conceptIds),
        );
      }
    },
    { timeout: 20_000 },
  );
  return { id };
}
export async function revealHint(
  actor: Actor,
  classroomId: string,
  id: string,
  questionId: string,
) {
  return getDatabase().$transaction(async (db) => {
    await lockStudent(db, actor, classroomId);
    const attempt = await activeAttempt(db, actor, classroomId, id);
    if (attempt.submittedAt) throw new AppError(409, m.conflict);
    const question = publishedAssessmentSchema
      .parse(attempt.snapshot)
      .questions.find((q) => q.id === questionId);
    if (!question?.hint) throw new AppError(404, m.notFound);
    await recordLearningEvent(db, {
      classroomId,
      userId: actor.id,
      type: "hint_requested",
      resourceId: id,
      dedupeKey: `hint_requested:${id}:${questionId}`,
    });
    await db.questionAttempt.update({
      where: {
        attemptId_questionKey: { attemptId: id, questionKey: questionId },
      },
      data: { hintsUsed: 1 },
    });
    return { hint: question.hint };
  });
}
export async function assessmentAttempts(
  actor: Actor,
  classroomId: string,
  assessmentId: string,
) {
  await ownedClassroom(actor, classroomId, false);
  return getDatabase().attempt.findMany({
    where: {
      assessmentId,
      submittedAt: { not: null },
      assessment: { classroomId, classroom: { teacherId: actor.id } },
    },
    select: {
      id: true,
      number: true,
      score: true,
      maximumScore: true,
      pendingReview: true,
      submittedAt: true,
      student: { select: { name: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
}
export async function reviewAttempt(
  actor: Actor,
  classroomId: string,
  id: string,
  input: { questionId: string; marks: number; feedback: string },
) {
  return getDatabase().$transaction(
    async (db) => {
      await lockOwnedClassroom(db, actor, classroomId);
      const attempt = await db.attempt.findFirst({
        where: {
          id,
          submittedAt: { not: null },
          assessment: { classroomId, classroom: { teacherId: actor.id } },
        },
        include: { questions: true },
      });
      if (!attempt) throw new AppError(404, m.notFound);
      const question = publishedAssessmentSchema
        .parse(attempt.snapshot)
        .questions.find((q) => q.id === input.questionId);
      if (!question || input.marks > question.marks)
        throw new AppError(400, m.invalidAnswer);
      await db.questionAttempt.update({
        where: {
          attemptId_questionKey: {
            attemptId: id,
            questionKey: input.questionId,
          },
        },
        data: {
          marks: Math.round(input.marks * 100) / 100,
          feedback: input.feedback,
          needsReview: false,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
        },
      });
      const grades = await db.questionAttempt.findMany({
        where: { attemptId: id },
        select: { marks: true, needsReview: true },
      });
      await db.attempt.update({
        where: { id },
        data: {
          score:
            Math.round(
              grades.reduce((sum, q) => sum + (q.marks ?? 0), 0) * 100,
            ) / 100,
          pendingReview: grades.some((q) => q.needsReview),
        },
      });
      await updateMastery(
        db,
        classroomId,
        attempt.studentId,
        question.conceptIds,
      );
      return { id };
    },
    { timeout: 20_000 },
  );
}
