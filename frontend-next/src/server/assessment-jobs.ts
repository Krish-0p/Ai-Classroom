import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "@/features/auth/schema";
import { getDatabase } from "@/db/client";
import { ownedClassroom, lockOwnedClassroom } from "@/server/curriculum-access";
import {
  assessmentDocument,
  writeQuestions,
  validateQuestionConcepts,
} from "@/server/assessments";
import {
  generationOptionsSchema,
  assessmentSchema,
  type GenerationOptions,
} from "@/features/assessments/schema";
import {
  configuredProviders,
  routeStructured,
  type GenerationMetadata,
} from "@/ai/router/structured";
import {
  assessmentPrompt,
  ASSESSMENT_PROMPT_VERSION,
} from "@/ai/prompts/assessment";
import { AppError } from "@/server/errors";
import { assessmentMessages as m } from "@/lib/assessment-messages";
import { curriculumMessages as cm } from "@/lib/curriculum-messages";
export async function startAssessmentJob(
  actor: Actor,
  classroomId: string,
  assessmentId: string,
  version: number,
  options: GenerationOptions,
) {
  const classroom = await ownedClassroom(actor, classroomId);
  const providers = configuredProviders("fast");
  if (!providers.length) throw new AppError(503, m.aiUnavailable);
  return getDatabase().$transaction(async (db) => {
    await lockOwnedClassroom(db, actor, classroomId);
    const row = await db.assessment.findFirst({
      where: {
        id: assessmentId,
        classroomId,
        classroom: { teacherId: actor.id },
      },
    });
    if (!row) throw new AppError(404, m.notFound);
    if (row.version !== version) throw new AppError(409, m.conflict);
    if (
      (await db.concept.count({
        where: { classroomId, id: { in: options.conceptIds } },
      })) !== new Set(options.conceptIds).size
    )
      throw new AppError(400, m.selectConcepts);
    await db.generationJob.updateMany({
      where: {
        classroomId,
        status: { in: ["queued", "generating"] },
        createdAt: { lt: new Date(Date.now() - 180_000) },
      },
      data: { status: "failed", error: cm.timeout },
    });
    if (
      await db.generationJob.count({
        where: { classroomId, status: { in: ["queued", "generating"] } },
      })
    )
      throw new AppError(409, cm.activeJob);
    const curriculum = await db.curriculum.findUnique({
      where: { classroomId },
    });
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify({
          assessmentId,
          options,
          course: classroom.name,
          level: classroom.academicLevel,
          language: classroom.language,
          title: row.title,
          curriculumVersion: curriculum?.approvedVersion,
          promptVersion: ASSESSMENT_PROMPT_VERSION,
          providers: providers.map((p) => [p.name, p.model]),
        }),
      )
      .digest("hex");
    const cached = await db.generationJob.findFirst({
      where: {
        classroomId,
        assessmentId,
        inputHash,
        status: "complete",
        version: version - 1,
      },
      select: { id: true },
    });
    if (cached) return cached;
    if (
      (await db.generationJob.count({
        where: {
          classroomId,
          createdBy: actor.id,
          createdAt: { gt: new Date(Date.now() - 60_000) },
        },
      })) >= 3
    )
      throw new AppError(429, cm.rateLimit);
    return db.generationJob.create({
      data: {
        classroomId,
        assessmentId,
        createdBy: actor.id,
        task: "QUIZ_GENERATION",
        inputHash,
        version,
        sourceIds: curriculum?.approvedSourceIds ?? [],
        metadata: {
          options,
          curriculumVersion: curriculum?.approvedVersion ?? 0,
        },
      },
      select: { id: true },
    });
  });
}
export async function runAssessmentJob(id: string) {
  const db = getDatabase();
  const job = await db.generationJob.findUnique({ where: { id } });
  if (
    !job ||
    !job.assessmentId ||
    job.task !== "QUIZ_GENERATION" ||
    job.status !== "queued"
  )
    return;
  const attempts: GenerationMetadata[] = [];
  try {
    if (
      !(
        await db.generationJob.updateMany({
          where: { id, status: "queued" },
          data: { status: "generating", progress: 20 },
        })
      ).count
    )
      return;
    const actor: Actor = { id: job.createdBy, role: "teacher", name: "" };
    const classroom = await ownedClassroom(actor, job.classroomId);
    const metadata =
      job.metadata &&
      typeof job.metadata === "object" &&
      !Array.isArray(job.metadata)
        ? job.metadata
        : {};
    const options = generationOptionsSchema.parse(metadata.options);
    const row = await db.assessment.findFirst({
      where: {
        id: job.assessmentId,
        classroomId: job.classroomId,
        classroom: { teacherId: actor.id },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!row) throw new AppError(404, m.notFound);
    const concepts = await db.concept.findMany({
      where: { classroomId: job.classroomId, id: { in: options.conceptIds } },
      select: { id: true, title: true, description: true },
    });
    const sources = await db.sourceDocument.findMany({
      where: { classroomId: job.classroomId, id: { in: job.sourceIds } },
      select: { filename: true, extractedText: true },
    });
    if (
      sources.length !== job.sourceIds.length ||
      sources.reduce((n, s) => n + s.extractedText.length, 0) > 120_000
    )
      throw new AppError(413, cm.tooLarge);
    const output = await routeStructured(
      assessmentPrompt({
        course: classroom.name,
        level: classroom.academicLevel,
        language: classroom.language,
        title: row.title,
        concepts,
        sources,
        options,
      }),
      configuredProviders("fast"),
      (entry) => {
        attempts.push(entry);
        console.info("AI generation", { task: job.task, jobId: id, ...entry });
      },
    );
    const document = assessmentSchema.parse({
      ...assessmentDocument(row),
      questions: output.questions.map((q) => ({
        ...q,
        id: `question_${randomUUID().replaceAll("-", "")}`,
      })),
    });
    await db.$transaction(
      async (transaction) => {
        await lockOwnedClassroom(transaction, actor, job.classroomId);
        const current = await transaction.assessment.findUnique({
          where: { id: row.id },
        });
        const currentJob = await transaction.generationJob.findUnique({
          where: { id },
        });
        const curriculum = await transaction.curriculum.findUnique({
          where: { classroomId: job.classroomId },
        });
        if (
          current?.version !== job.version ||
          currentJob?.status !== "generating" ||
          (curriculum?.approvedVersion ?? 0) !== metadata.curriculumVersion
        )
          throw new AppError(409, m.conflict);
        await validateQuestionConcepts(transaction, job.classroomId, document);
        await writeQuestions(transaction, row.id, document);
        await transaction.assessment.update({
          where: { id: row.id },
          data: { version: { increment: 1 } },
        });
        await transaction.generationJob.update({
          where: { id },
          data: {
            status: "complete",
            progress: 100,
            metadata: { ...metadata, attempts },
          },
        });
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    await db.generationJob
      .updateMany({
        where: { id, status: { in: ["queued", "generating"] } },
        data: {
          status: "failed",
          error: error instanceof AppError ? error.message : m.generationFailed,
          metadata: { attempts },
        },
      })
      .catch(() => console.error("Could not persist assessment job status"));
  }
}
