import "server-only";
import { getDatabase } from "@/db/client";
import type { Actor } from "@/features/auth/schema";
import { ownedClassroom, lockOwnedClassroom } from "./curriculum-access";
import { chunkSource, sourceFingerprint } from "@/ai/rag/chunking";
import { embeddingProvider } from "@/ai/router/embedding";
import { AppError } from "./errors";
import { tutorMessages as m } from "@/lib/tutor-messages";

export async function readIndexes(actor: Actor, classroomId: string) {
  await ownedClassroom(actor, classroomId, false);
  const db = getDatabase();
  const curriculum = await db.curriculum.findUnique({
    where: { classroomId },
    select: { approvedSourceIds: true },
  });
  const sources = await db.sourceDocument.findMany({
    where: { classroomId, id: { in: curriculum?.approvedSourceIds ?? [] } },
    select: {
      id: true,
      filename: true,
      contentHash: true,
      indexes: { select: { fingerprint: true, ready: true } },
    },
  });
  const job = await db.generationJob.findFirst({
    where: { classroomId, task: "EMBEDDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      progress: true,
      error: true,
      createdAt: true,
    },
  });
  if (
    job &&
    ["queued", "generating"].includes(job.status) &&
    Date.now() - job.createdAt.getTime() > 180_000
  ) {
    job.status = "failed";
    job.error = m.timeout;
  }
  return {
    sources: sources.map((source) => ({
      id: source.id,
      filename: source.filename,
      ready: source.indexes.some(
        (index) =>
          index.ready &&
          index.fingerprint ===
            sourceFingerprint(
              source.contentHash,
              process.env.GEMINI_EMBEDDING_MODEL ?? "",
            ),
      ),
    })),
    job,
  };
}
export async function startIndex(
  actor: Actor,
  classroomId: string,
  sourceId: string,
) {
  await ownedClassroom(actor, classroomId);
  const provider = embeddingProvider();
  return getDatabase().$transaction(async (db) => {
    await lockOwnedClassroom(db, actor, classroomId);
    const curriculum = await db.curriculum.findUnique({
      where: { classroomId },
    });
    if (!curriculum?.approvedSourceIds.includes(sourceId))
      throw new AppError(400, m.noSources);
    const source = await db.sourceDocument.findFirst({
      where: { id: sourceId, classroomId, processingStatus: "ready" },
    });
    if (!source) throw new AppError(404, m.notFound);
    const fingerprint = sourceFingerprint(source.contentHash, provider.model);
    const cached = await db.sourceIndex.findUnique({
      where: { sourceId_fingerprint: { sourceId, fingerprint } },
    });
    if (cached?.ready) return { id: null, cached: true };
    const chunks = chunkSource(source.metadata, source.extractedText);
    if (!chunks.length || chunks.length > 160)
      throw new AppError(
        413,
        "Use a source with 1–160 text chunks; split larger material into separate documents.",
      );
    await db.generationJob.updateMany({
      where: {
        classroomId,
        status: { in: ["queued", "generating"] },
        createdAt: { lt: new Date(Date.now() - 180_000) },
      },
      data: { status: "failed", error: m.timeout },
    });
    if (
      await db.generationJob.count({
        where: { classroomId, status: { in: ["queued", "generating"] } },
      })
    )
      throw new AppError(409, m.indexBusy);
    if (
      (await db.generationJob.count({
        where: {
          classroomId,
          createdBy: actor.id,
          createdAt: { gt: new Date(Date.now() - 60_000) },
        },
      })) >= 3
    )
      throw new AppError(429, m.rateLimit);
    const job = await db.generationJob.create({
      data: {
        classroomId,
        createdBy: actor.id,
        task: "EMBEDDING",
        sourceIds: [sourceId],
        version: curriculum.approvedVersion,
        inputHash: fingerprint,
      },
      select: { id: true },
    });
    return { ...job, cached: false };
  });
}
export async function runIndex(id: string) {
  const db = getDatabase();
  const job = await db.generationJob.findUnique({ where: { id } });
  if (!job || job.task !== "EMBEDDING" || job.status !== "queued") return;
  try {
    if (
      !(
        await db.generationJob.updateMany({
          where: { id, status: "queued" },
          data: { status: "generating", progress: 5 },
        })
      ).count
    )
      return;
    const actor: Actor = { id: job.createdBy, role: "teacher", name: "" };
    await ownedClassroom(actor, job.classroomId);
    const provider = embeddingProvider();
    const source = await db.sourceDocument.findFirst({
      where: { id: job.sourceIds[0], classroomId: job.classroomId },
    });
    if (
      !source ||
      sourceFingerprint(source.contentHash, provider.model) !== job.inputHash
    )
      throw new AppError(409, m.stale);
    const chunks = chunkSource(source.metadata, source.extractedText);
    const index = await db.sourceIndex.upsert({
      where: {
        sourceId_fingerprint: {
          sourceId: source.id,
          fingerprint: job.inputHash,
        },
      },
      create: {
        classroomId: job.classroomId,
        sourceId: source.id,
        fingerprint: job.inputHash,
        model: provider.model,
      },
      update: {},
    });
    const stored = await db.$queryRaw<
      { ordinal: number }[]
    >`SELECT ordinal FROM "SourceChunk" WHERE "indexId"=${index.id} AND embedding IS NOT NULL`;
    const cached = new Set(stored.map((row) => row.ordinal));
    const missing = chunks
      .map((chunk, ordinal) => ({ ...chunk, ordinal }))
      .filter((chunk) => !cached.has(chunk.ordinal));
    for (let offset = 0; offset < missing.length; offset += 16) {
      if (Date.now() - job.createdAt.getTime() > 130_000)
        throw new AppError(408, m.timeout);
      const approval = await db.curriculum.findFirst({
        where: {
          classroomId: job.classroomId,
          approvedSourceIds: { has: source.id },
          classroom: { teacherId: actor.id, status: "active" },
        },
        select: { classroomId: true },
      });
      if (!approval) throw new AppError(409, m.stale);
      const batch = missing.slice(offset, offset + 16);
      const vectors = await provider.embed(
        batch.map((chunk) => chunk.text),
        "RETRIEVAL_DOCUMENT",
        id,
      );
      await db.$transaction(async (transaction) => {
        await lockOwnedClassroom(transaction, actor, job.classroomId);
        const current = await transaction.generationJob.findFirst({
          where: { id, status: "generating" },
        });
        const curriculum = await transaction.curriculum.findUnique({
          where: { classroomId: job.classroomId },
        });
        if (!current || !curriculum?.approvedSourceIds.includes(source.id))
          throw new AppError(409, m.stale);
        for (const [position, chunk] of batch.entries()) {
          const record = await transaction.sourceChunk.upsert({
            where: {
              indexId_ordinal: { indexId: index.id, ordinal: chunk.ordinal },
            },
            create: {
              indexId: index.id,
              ordinal: chunk.ordinal,
              text: chunk.text,
              label: chunk.label,
            },
            update: {},
          });
          await transaction.$executeRaw`UPDATE "SourceChunk" SET embedding=${JSON.stringify(vectors[position])}::vector WHERE id=${record.id} AND "indexId"=${index.id}`;
        }
        await transaction.generationJob.update({
          where: { id },
          data: {
            progress: Math.min(
              95,
              Math.round(
                ((cached.size + offset + batch.length) / chunks.length) * 95,
              ),
            ),
          },
        });
      });
    }
    await db.$transaction(async (transaction) => {
      await lockOwnedClassroom(transaction, actor, job.classroomId);
      const curriculum = await transaction.curriculum.findUnique({
        where: { classroomId: job.classroomId },
      });
      if (!curriculum?.approvedSourceIds.includes(source.id))
        throw new AppError(409, m.stale);
      if (
        !(
          await transaction.generationJob.updateMany({
            where: { id, status: "generating" },
            data: {
              status: "complete",
              progress: 100,
              metadata: {
                model: provider.model,
                chunks: chunks.length,
                dimensions: 768,
              },
            },
          })
        ).count
      )
        throw new AppError(409, m.stale);
      await transaction.sourceIndex.update({
        where: { id: index.id },
        data: { ready: true },
      });
    });
  } catch (error) {
    console.error("Index job failed", {
      jobId: id,
      type: error instanceof Error ? error.name : "unknown",
    });
    await db.generationJob.updateMany({
      where: { id, status: { in: ["queued", "generating"] } },
      data: {
        status: "failed",
        error: error instanceof AppError ? error.message : m.indexFailed,
      },
    });
  }
}
