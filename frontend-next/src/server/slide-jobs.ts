import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import type { Actor } from "@/features/auth/schema";
import {
  generateSlidesSchema,
  slideDeckSchema,
  type GenerateSlidesInput,
} from "@/features/slides/schema";
import {
  configuredProviders,
  routeStructured,
  type GenerationMetadata,
} from "@/ai/router/structured";
import { slidesPrompt, SLIDES_PROMPT_VERSION } from "@/ai/prompts/slides";
import { ProviderError, StructuredOutputError } from "@/ai/providers/provider";
import { approvedSlideCurriculum } from "./slides";
import { lockOwnedClassroom } from "./curriculum-access";
import { AppError } from "./errors";
import { slideMessages as m } from "@/lib/slide-messages";
import { curriculumMessages as cm } from "@/lib/curriculum-messages";

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const metadataSchema = generateSlidesSchema.extend({
  curriculumVersion: z.number().int().positive(),
});
export async function startSlideJob(
  actor: Actor,
  classroomId: string,
  input: GenerateSlidesInput,
) {
  const providers = configuredProviders("fast");
  if (!providers.length) throw new AppError(503, m.unavailable);
  return getDatabase().$transaction(async (db) => {
    await lockOwnedClassroom(db, actor, classroomId);
    const curriculum = await approvedSlideCurriculum(db, classroomId);
    const classroom = await db.classroom.findUniqueOrThrow({
      where: { id: classroomId },
    });
    const deck = await db.slideDeck.findUnique({ where: { classroomId } });
    if ((deck?.version ?? 0) !== input.version)
      throw new AppError(409, m.conflict);
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
    const inputHash = hash({
      task: "SLIDES_GENERATION",
      count: input.count,
      instruction: input.instruction,
      curriculumVersion: curriculum.version,
      language: classroom.language,
      academicLevel: classroom.academicLevel,
      providers: providers.map((provider) => [provider.name, provider.model]),
      promptVersion: SLIDES_PROMPT_VERSION,
      tokenLimit: process.env.GROQ_MAX_COMPLETION_TOKENS,
      outputMode: process.env.GROQ_STRUCTURED_OUTPUT_MODE,
    });
    const cached = await db.generationJob.findFirst({
      where: {
        classroomId,
        task: "SLIDES_GENERATION",
        inputHash,
        status: "complete",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true },
    });
    if (
      deck &&
      cached?.metadata &&
      typeof cached.metadata === "object" &&
      !Array.isArray(cached.metadata) &&
      cached.metadata.outputHash === hash(deck.draft)
    )
      return { id: cached.id };
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
        createdBy: actor.id,
        task: "SLIDES_GENERATION",
        inputHash,
        sourceIds: [],
        version: input.version,
        metadata: { ...input, curriculumVersion: curriculum.version },
      },
      select: { id: true },
    });
  });
}
export async function runSlideJob(id: string) {
  const db = getDatabase();
  const job = await db.generationJob.findUnique({ where: { id } });
  if (!job || job.task !== "SLIDES_GENERATION" || job.status !== "queued")
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
    const input = metadataSchema.parse(job.metadata);
    const context = await db.$transaction(async (tx) => {
      await lockOwnedClassroom(tx, actor, job.classroomId);
      const curriculum = await approvedSlideCurriculum(tx, job.classroomId);
      if (curriculum.version !== input.curriculumVersion)
        throw new AppError(409, m.conflict);
      const classroom = await tx.classroom.findUniqueOrThrow({
        where: { id: job.classroomId },
      });
      return { curriculum, classroom };
    });
    const output = await routeStructured(
      slidesPrompt({
        curriculum: context.curriculum.document,
        academicLevel: context.classroom.academicLevel,
        language: context.classroom.language,
        count: input.count,
        instruction: input.instruction,
      }),
      configuredProviders("fast"),
      (entry) => {
        attempts.push(entry);
        console.info("AI generation", { task: job.task, jobId: id, ...entry });
      },
    );
    const document = slideDeckSchema.parse(output);
    await db.$transaction(async (tx) => {
      await lockOwnedClassroom(tx, actor, job.classroomId);
      const [current, currentJob, curriculum] = await Promise.all([
        tx.slideDeck.findUnique({ where: { classroomId: job.classroomId } }),
        tx.generationJob.findUnique({ where: { id } }),
        approvedSlideCurriculum(tx, job.classroomId),
      ]);
      if (
        (current?.version ?? 0) !== job.version ||
        currentJob?.status !== "generating" ||
        curriculum.version !== input.curriculumVersion
      )
        throw new AppError(409, m.conflict);
      await tx.slideDeck.upsert({
        where: { classroomId: job.classroomId },
        create: {
          classroomId: job.classroomId,
          draft: document,
          curriculumVersion: curriculum.version,
          aiGenerated: true,
        },
        update: {
          draft: document,
          curriculumVersion: curriculum.version,
          aiGenerated: true,
          version: { increment: 1 },
        },
      });
      await tx.generationJob.update({
        where: { id },
        data: {
          status: "complete",
          progress: 100,
          metadata: { ...input, attempts, outputHash: hash(document) },
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
              : error instanceof StructuredOutputError
                ? m.invalid
                : m.failed,
          metadata: { attempts },
        },
      })
      .catch(() =>
        console.error("Could not persist slide job status", { jobId: id }),
      );
  }
}
