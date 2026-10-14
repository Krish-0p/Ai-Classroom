import "server-only";
import { ProviderError } from "@/ai/providers/provider";
import { createHash } from "node:crypto";
import type { Actor } from "@/features/auth/schema";
import { getDatabase } from "@/db/client";
import { ownedClassroom, lockOwnedClassroom } from "@/server/curriculum-access";
import {
  configuredProviders,
  routeCurriculum,
  type GenerationMetadata,
} from "@/ai/router/curriculum";
import {
  curriculumPrompt,
  CURRICULUM_PROMPT_VERSION,
} from "@/ai/prompts/curriculum";
import { AppError } from "@/server/errors";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
const JOB_TIMEOUT = 180_000;
export async function startCurriculumJob(
  actor: Actor,
  classroomId: string,
  sourceIds: string[],
) {
  const classroom = await ownedClassroom(actor, classroomId);
  const providers = configuredProviders();
  if (!providers.length) throw new AppError(503, m.aiUnavailable);
  return getDatabase().$transaction(async (transaction) => {
    await lockOwnedClassroom(transaction, actor, classroomId);
    await transaction.generationJob.updateMany({
      where: {
        classroomId,
        status: { in: ["queued", "generating"] },
        createdAt: { lt: new Date(Date.now() - JOB_TIMEOUT) },
      },
      data: { status: "failed", error: m.timeout },
    });
    if (
      await transaction.generationJob.count({
        where: { classroomId, status: { in: ["queued", "generating"] } },
      })
    )
      throw new AppError(409, m.activeJob);
    const sources = await transaction.sourceDocument.findMany({
      where: { classroomId, id: { in: sourceIds }, processingStatus: "ready" },
      select: { id: true, extractedText: true },
    });
    if (sources.length !== sourceIds.length)
      throw new AppError(404, m.sourceMissing);
    if (
      sources.reduce((sum, source) => sum + source.extractedText.length, 0) >
      120_000
    )
      throw new AppError(413, m.tooLarge);
    const curriculum = await transaction.curriculum.findUnique({
      where: { classroomId },
    });
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify({
          sourceIds: [...sourceIds].sort(),
          name: classroom.name,
          language: classroom.language,
          academicLevel: classroom.academicLevel,
          promptVersion: CURRICULUM_PROMPT_VERSION,
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
        task: "CURRICULUM_EXTRACTION",
        inputHash,
        status: "complete",
        version: (curriculum?.draftVersion ?? 0) - 1,
      },
      orderBy: { createdAt: "desc" },
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
      throw new AppError(429, m.rateLimit);
    return transaction.generationJob.create({
      data: {
        classroomId,
        createdBy: actor.id,
        version: curriculum?.draftVersion ?? 0,
        sourceIds,
        inputHash,
      },
      select: { id: true },
    });
  });
}
export async function runCurriculumJob(id: string) {
  const db = getDatabase();
  const job = await db.generationJob.findUnique({ where: { id } });
  if (!job || job.task !== "CURRICULUM_EXTRACTION" || job.status !== "queued")
    return;
  const metadata: GenerationMetadata[] = [];
  try {
    const claimed = await db.generationJob.updateMany({
      where: { id, status: "queued" },
      data: { status: "generating", progress: 20 },
    });
    if (!claimed.count) return;
    const actor: Actor = { id: job.createdBy, role: "teacher", name: "" };
    const classroom = await ownedClassroom(actor, job.classroomId);
    const sources = await db.sourceDocument.findMany({
      where: {
        classroomId: job.classroomId,
        id: { in: job.sourceIds },
        classroom: { teacherId: job.createdBy },
      },
      select: { filename: true, extractedText: true },
    });
    if (sources.length !== job.sourceIds.length)
      throw new AppError(404, m.sourceMissing);
    const draft = await routeCurriculum(
      curriculumPrompt(
        {
          name: classroom.name,
          academicLevel: classroom.academicLevel,
          language: classroom.language,
        },
        sources,
      ),
      undefined,
      (entry) => {
        metadata.push(entry);
        console.info("AI generation", {
          task: job.task,
          jobId: job.id,
          ...entry,
        });
      },
    );
    await db.$transaction(async (transaction) => {
      await lockOwnedClassroom(transaction, actor, job.classroomId);
      const currentJob = await transaction.generationJob.findUnique({
        where: { id },
      });
      const current = await transaction.curriculum.findUnique({
        where: { classroomId: job.classroomId },
      });
      if (
        currentJob?.status !== "generating" ||
        (current?.draftVersion ?? 0) !== job.version
      )
        throw new AppError(409, m.conflict);
      await transaction.curriculum.upsert({
        where: { classroomId: job.classroomId },
        create: {
          classroomId: job.classroomId,
          draft,
          draftVersion: 1,
          sourceIds: job.sourceIds,
        },
        update: {
          draft,
          draftVersion: { increment: 1 },
          sourceIds: job.sourceIds,
        },
      });
      await transaction.generationJob.update({
        where: { id },
        data: { status: "complete", progress: 100, metadata },
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
              : m.aiFailed,
          metadata,
        },
      })
      .catch(() => {
        console.error("Could not persist curriculum job status");
      });
  }
}
export async function readCurriculumJob(
  actor: Actor,
  classroomId: string,
  id: string,
) {
  await ownedClassroom(actor, classroomId, false);
  await getDatabase().generationJob.updateMany({
    where: {
      id,
      classroomId,
      status: { in: ["queued", "generating"] },
      createdAt: { lt: new Date(Date.now() - JOB_TIMEOUT) },
    },
    data: { status: "failed", error: m.timeout },
  });
  const job = await getDatabase().generationJob.findFirst({
    where: { id, classroomId, classroom: { teacherId: actor.id } },
    select: { id: true, status: true, progress: true, error: true },
  });
  if (!job) throw new AppError(404, m.sourceMissing);
  return job;
}
