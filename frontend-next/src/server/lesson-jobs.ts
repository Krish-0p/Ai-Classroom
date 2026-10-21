import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "@/features/auth/schema";
import { getDatabase } from "@/db/client";
import { lockOwnedClassroom, ownedClassroom } from "@/server/curriculum-access";
import { lessonDocument, writeLessonBlocks } from "@/server/lessons";
import { lessonSchema, generatedLessonSchema } from "@/features/lessons/schema";
import { mergeLockedBlocks } from "@/features/lessons/merge-blocks";
import {
  routeStructured,
  type GenerationMetadata,
} from "@/ai/router/structured";
import { lessonPrompt, LESSON_PROMPT_VERSION } from "@/ai/prompts/lesson";
import { AppError } from "@/server/errors";
import { curriculumMessages as cm } from "@/lib/curriculum-messages";
import { lessonMessages as m } from "@/lib/lesson-messages";
import { teacherTextProviders } from "./teacher-ai-settings";
import { ProviderError } from "@/ai/providers/provider";

export async function startLessonJob(
  actor: Actor,
  classroomId: string,
  lessonId: string,
  version: number,
  instruction: string,
) {
  const classroom = await ownedClassroom(actor, classroomId);
  const providers = await teacherTextProviders(actor.id);
  if (!providers.length) throw new AppError(503, m.aiUnavailable);
  return getDatabase().$transaction(async (transaction) => {
    await lockOwnedClassroom(transaction, actor, classroomId);
    const lesson = await transaction.lesson.findFirst({
      where: { id: lessonId, classroomId, classroom: { teacherId: actor.id } },
    });
    if (!lesson) throw new AppError(404, m.notFound);
    if (lesson.version !== version) throw new AppError(409, m.conflict);
    await transaction.generationJob.updateMany({
      where: {
        classroomId,
        status: { in: ["queued", "generating"] },
        createdAt: { lt: new Date(Date.now() - 180_000) },
      },
      data: { status: "failed", error: cm.timeout },
    });
    if (
      await transaction.generationJob.count({
        where: { classroomId, status: { in: ["queued", "generating"] } },
      })
    )
      throw new AppError(409, cm.activeJob);
    const curriculum = await transaction.curriculum.findUnique({
      where: { classroomId },
    });
    if (!curriculum?.approved) throw new AppError(409, m.missingConcept);
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify({
          task: "LESSON_GENERATION",
          lessonId,
          instruction,
          curriculumVersion: curriculum.approvedVersion,
          course: classroom.name,
          language: classroom.language,
          academicLevel: classroom.academicLevel,
          promptVersion: LESSON_PROMPT_VERSION,
          providers: providers.map((provider) => [
            provider.name,
            provider.model,
          ]),
        }),
      )
      .digest("hex");
    const cached = await transaction.generationJob.findFirst({
      where: {
        classroomId,
        lessonId,
        inputHash,
        task: "LESSON_GENERATION",
        status: "complete",
        version: version - 1,
      },
      select: { id: true },
    });
    if (cached) return cached;
    if (
      (await transaction.generationJob.count({
        where: {
          classroomId,
          createdBy: actor.id,
          createdAt: { gt: new Date(Date.now() - 60_000) },
        },
      })) >= 3
    )
      throw new AppError(429, cm.rateLimit);
    return transaction.generationJob.create({
      data: {
        classroomId,
        lessonId,
        createdBy: actor.id,
        task: "LESSON_GENERATION",
        inputHash,
        version,
        sourceIds: curriculum.approvedSourceIds,
        metadata: {
          instruction,
          curriculumVersion: curriculum.approvedVersion,
        },
      },
      select: { id: true },
    });
  });
}
export async function runLessonJob(id: string) {
  const db = getDatabase();
  const job = await db.generationJob.findUnique({ where: { id } });
  if (
    !job ||
    job.task !== "LESSON_GENERATION" ||
    !job.lessonId ||
    job.status !== "queued"
  )
    return;
  const records: GenerationMetadata[] = [];
  try {
    const claimed = await db.generationJob.updateMany({
      where: { id, status: "queued" },
      data: { status: "generating", progress: 20 },
    });
    if (!claimed.count) return;
    const actor: Actor = { id: job.createdBy, role: "teacher", name: "" };
    const classroom = await ownedClassroom(actor, job.classroomId);
    const lesson = await db.lesson.findFirst({
      where: {
        id: job.lessonId,
        classroomId: job.classroomId,
        classroom: { teacherId: actor.id },
      },
      include: {
        blocks: { orderBy: { order: "asc" } },
        concept: {
          include: { prerequisites: { include: { prerequisite: true } } },
        },
      },
    });
    if (!lesson) throw new AppError(404, m.notFound);
    const metadata =
      job.metadata &&
      typeof job.metadata === "object" &&
      !Array.isArray(job.metadata)
        ? job.metadata
        : {};
    const instruction =
      typeof metadata.instruction === "string" ? metadata.instruction : "";
    const sources = await db.sourceDocument.findMany({
      where: {
        classroomId: job.classroomId,
        id: { in: job.sourceIds },
        classroom: { teacherId: actor.id },
      },
      select: { filename: true, extractedText: true },
    });
    if (sources.length !== job.sourceIds.length)
      throw new AppError(404, cm.sourceMissing);
    if (
      sources.reduce((sum, source) => sum + source.extractedText.length, 0) >
      120_000
    )
      throw new AppError(413, cm.tooLarge);
    const generated = generatedLessonSchema.parse(
      await routeStructured(
        lessonPrompt({
          course: classroom.name,
          academicLevel: classroom.academicLevel,
          language: classroom.language,
          concept: {
            title: lesson.concept.title,
            description: lesson.concept.description,
          },
          prerequisites: lesson.concept.prerequisites.map(
            (edge) => edge.prerequisite.title,
          ),
          sources,
          instruction,
        }),
        await teacherTextProviders(job.createdBy),
        (entry) => {
          records.push(entry);
          console.info("AI generation", {
            task: job.task,
            jobId: job.id,
            ...entry,
          });
        },
      ),
    );
    const blocks = generated.blocks.map((block) => ({
      ...block,
      id: `block_${randomUUID().replaceAll("-", "")}`,
      locked: false,
    }));
    const document = lessonSchema.parse({
      ...generated,
      blocks: mergeLockedBlocks(lessonDocument(lesson).blocks, blocks),
    });
    await db.$transaction(async (transaction) => {
      await lockOwnedClassroom(transaction, actor, job.classroomId);
      const current = await transaction.lesson.findFirst({
        where: { id: lesson.id, classroomId: job.classroomId },
      });
      const currentJob = await transaction.generationJob.findUnique({
        where: { id },
      });
      const curriculum = await transaction.curriculum.findUnique({
        where: { classroomId: job.classroomId },
      });
      if (
        !current ||
        current.version !== job.version ||
        currentJob?.status !== "generating" ||
        curriculum?.approvedVersion !== metadata.curriculumVersion
      )
        throw new AppError(409, m.conflict);
      await writeLessonBlocks(transaction, lesson.id, document);
      await transaction.lesson.update({
        where: { id: lesson.id },
        data: {
          title: document.title,
          estimatedMinutes: document.estimatedMinutes,
          version: { increment: 1 },
          ...(current.status === "review" ? { status: "draft" } : {}),
        },
      });
      await transaction.generationJob.update({
        where: { id },
        data: {
          status: "complete",
          progress: 100,
          metadata: { ...metadata, attempts: records },
        },
      });
    });
  } catch (error) {
    await db.generationJob
      .updateMany({
        where: { id, status: { in: ["queued", "generating"] } },
        data: {
          status: "failed",
          error:
            error instanceof AppError || error instanceof ProviderError
              ? error.message
              : m.failed,
          metadata: { attempts: records },
        },
      })
      .catch(() => console.error("Could not persist lesson job status"));
  }
}
