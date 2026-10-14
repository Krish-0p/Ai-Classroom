import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import type { Actor } from "@/features/auth/schema";
import { citationSchema, tutorQuestionSchema } from "@/features/tutor/schema";
import { readClassroom } from "./classrooms";
import { ownedClassroom } from "./curriculum-access";
import { lockLearningActor, recordLearningEvent } from "./learning-events";
import { embeddingProvider } from "@/ai/router/embedding";
import { configuredProviders, routeStructured } from "@/ai/router/structured";
import { PgVectorRetrieval } from "@/ai/rag/retrieval";
import { tutorPrompt, TUTOR_PROMPT_VERSION } from "@/ai/prompts/tutor";
import { publishedLessonSchema } from "@/features/lessons/schema";
import { AppError } from "./errors";
import { tutorMessages as m } from "@/lib/tutor-messages";
const lifetime = 180_000;
export async function readTutor(actor: Actor, classroomId: string) {
  await readClassroom(actor, classroomId);
  const db = getDatabase();
  const [curriculum, rows, lessons] = await Promise.all([
    db.curriculum.findUnique({
      where: { classroomId },
      select: { approvedSourceIds: true },
    }),
    db.tutorMessage.findMany({
      where: { conversation: { classroomId, userId: actor.id } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        question: true,
        answer: true,
        citations: true,
        status: true,
        error: true,
        reported: true,
        createdAt: true,
      },
    }),
    db.lesson.findMany({
      where: { classroomId, status: "published" },
      select: { id: true, published: true },
      take: 100,
    }),
  ]);
  return {
    messages: rows.reverse().map((row) => {
      const citations = z.array(citationSchema).parse(row.citations);
      const revoked = citations.some(
        (citation) =>
          !curriculum?.approvedSourceIds.includes(citation.sourceId),
      );
      const expired =
        ["queued", "generating"].includes(row.status) &&
        Date.now() - row.createdAt.getTime() > lifetime;
      return {
        ...row,
        answer: revoked ? m.citationRemoved : row.answer,
        citations: revoked ? [] : citations,
        status: expired ? "failed" : row.status,
        error: expired ? m.timeout : row.error,
      };
    }),
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: publishedLessonSchema.parse(lesson.published).title,
    })),
  };
}
export async function startTutor(
  actor: Actor,
  classroomId: string,
  input: z.infer<typeof tutorQuestionSchema>,
) {
  const classroom = await readClassroom(actor, classroomId);
  if (!configuredProviders("fast").length)
    throw new AppError(503, m.unavailable);
  const provider = embeddingProvider();
  return getDatabase().$transaction(async (db) => {
    await lockLearningActor(db, actor, classroomId);
    const conversation = await db.tutorConversation.upsert({
      where: { classroomId_userId: { classroomId, userId: actor.id } },
      create: { classroomId, userId: actor.id },
      update: {},
    });
    const duplicate = await db.tutorMessage.findUnique({
      where: {
        conversationId_requestId: {
          conversationId: conversation.id,
          requestId: input.requestId,
        },
      },
      select: { id: true },
    });
    if (duplicate) return duplicate;
    await db.tutorMessage.updateMany({
      where: {
        conversationId: conversation.id,
        status: { in: ["queued", "generating"] },
        createdAt: { lt: new Date(Date.now() - lifetime) },
      },
      data: { status: "failed", error: m.timeout },
    });
    if (
      await db.tutorMessage.count({
        where: {
          conversationId: conversation.id,
          status: { in: ["queued", "generating"] },
        },
      })
    )
      throw new AppError(409, m.busy);
    const recent = { createdAt: { gt: new Date(Date.now() - 60_000) } };
    if (
      (await db.learningEvent.count({
        where: {
          classroomId,
          userId: actor.id,
          type: "tutor_question",
          ...recent,
        },
      })) >= 3 ||
      (await db.learningEvent.count({
        where: { classroomId, type: "tutor_question", ...recent },
      })) >= 20
    )
      throw new AppError(429, m.rateLimit);
    const curriculum = await db.curriculum.findUnique({
      where: { classroomId },
    });
    const readyIndexes = await db.sourceIndex.findMany({
      where: {
        classroomId,
        sourceId: { in: curriculum?.approvedSourceIds ?? [] },
        model: provider.model,
        ready: true,
      },
      select: { fingerprint: true },
    });
    const ready = readyIndexes.length > 0;
    let lessonTitle: string | null = null;
    let lessonVersion = 0;
    if (input.lessonId) {
      const lesson = await db.lesson.findFirst({
        where: { id: input.lessonId, classroomId, status: "published" },
      });
      if (!lesson) throw new AppError(404, m.notFound);
      lessonTitle = publishedLessonSchema.parse(lesson.published).title;
      lessonVersion = lesson.publishedVersion;
    }
    const contextHash = createHash("sha256")
      .update(
        JSON.stringify([
          TUTOR_PROMPT_VERSION,
          classroom.language,
          curriculum?.approvedVersion,
          lessonVersion,
          provider.model,
          readyIndexes.map((index) => index.fingerprint).sort(),
          process.env.TUTOR_MAX_COSINE_DISTANCE ?? "0.55",
          configuredProviders("fast").map((p) => [p.name, p.model]),
        ]),
      )
      .digest("hex");
    const cached = await db.tutorMessage.findFirst({
      where: {
        conversationId: conversation.id,
        question: input.question,
        lessonId: input.lessonId ?? null,
        status: "complete",
        reported: false,
        metadata: { path: ["contextHash"], equals: contextHash },
      },
      orderBy: { createdAt: "desc" },
    });
    const message = await db.tutorMessage.create({
      data: {
        conversationId: conversation.id,
        requestId: input.requestId,
        question: input.question,
        lessonId: input.lessonId,
        status: cached || !ready ? "complete" : "queued",
        answer: cached?.answer ?? (!ready ? m.insufficient : ""),
        citations: cached?.citations ?? [],
        metadata: {
          contextHash,
          approvedVersion: curriculum?.approvedVersion ?? 0,
          lessonTitle,
          lessonVersion,
        },
      },
      select: { id: true },
    });
    // Keep request counts after clearing chat history so quotas cannot be reset.
    await recordLearningEvent(db, {
      classroomId,
      userId: actor.id,
      type: "tutor_question",
      resourceId: message.id,
      dedupeKey: `tutor_question:${message.id}`,
    });
    return message;
  });
}
const contextSchema = z.object({
  contextHash: z.string(),
  approvedVersion: z.number(),
  lessonTitle: z.string().nullable(),
  lessonVersion: z.number(),
});
export async function runTutor(id: string) {
  const db = getDatabase();
  const message = await db.tutorMessage.findUnique({
    where: { id },
    include: {
      conversation: { include: { user: { select: { id: true, role: true } } } },
    },
  });
  if (!message || message.status !== "queued") return;
  const { classroomId, user } = message.conversation;
  const actor: Actor = { ...user, name: "" };
  try {
    if (
      !(
        await db.tutorMessage.updateMany({
          where: { id, status: "queued" },
          data: { status: "generating" },
        })
      ).count
    )
      return;
    const classroom = await readClassroom(actor, classroomId);
    if (classroom.status !== "active") throw new AppError(409, m.archived);
    const context = contextSchema.parse(message.metadata);
    const provider = embeddingProvider();
    const vector = (
      await provider.embed(
        [`${context.lessonTitle ?? ""}\n${message.question}`.trim()],
        "RETRIEVAL_QUERY",
        id,
      )
    )[0];
    const excerpts = await new PgVectorRetrieval().retrieve(
      db,
      actor,
      classroomId,
      provider.model,
      vector,
    );
    const metadata: {
      provider: string;
      model: string;
      latencyMs: number;
      attempt: number;
      schemaValid: boolean;
      tokens?: number;
    }[] = [];
    const result = excerpts.length
      ? await routeStructured(
          tutorPrompt(
            message.question,
            classroom.language,
            excerpts,
            context.lessonTitle,
          ),
          configuredProviders("fast"),
          (entry) => {
            metadata.push(entry);
            console.info("AI generation", {
              task: "TUTOR_RESPONSE",
              jobId: id,
              ...entry,
            });
          },
        )
      : { answer: m.insufficient, citationIds: [], sufficient: false };
    await db.$transaction(async (transaction) => {
      await lockLearningActor(transaction, actor, classroomId);
      const curriculum = await transaction.curriculum.findUnique({
        where: { classroomId },
      });
      if (
        curriculum?.approvedVersion !== context.approvedVersion ||
        excerpts.some(
          (item) => !curriculum?.approvedSourceIds.includes(item.sourceId),
        )
      )
        throw new AppError(409, m.stale);
      if (
        message.lessonId &&
        !(await transaction.lesson.count({
          where: {
            id: message.lessonId,
            classroomId,
            status: "published",
            publishedVersion: context.lessonVersion,
          },
        }))
      )
        throw new AppError(409, m.stale);
      await transaction.tutorMessage.updateMany({
        where: {
          id,
          status: "generating",
          conversation: { classroomId, userId: actor.id },
        },
        data: {
          status: "complete",
          answer: result.sufficient ? result.answer : m.insufficient,
          citations: result.sufficient
            ? excerpts.filter((item) => result.citationIds.includes(item.id))
            : [],
          metadata: { ...context, generation: metadata },
        },
      });
    });
  } catch (error) {
    console.error("Tutor job failed", {
      jobId: id,
      type: error instanceof Error ? error.name : "unknown",
    });
    await db.tutorMessage.updateMany({
      where: { id, status: { in: ["queued", "generating"] } },
      data: {
        status: "failed",
        error: error instanceof AppError ? error.message : m.error,
      },
    });
  }
}
export async function reportTutor(
  actor: Actor,
  classroomId: string,
  messageId: string,
) {
  return getDatabase().$transaction(async (db) => {
    await lockLearningActor(db, actor, classroomId);
    const result = await db.tutorMessage.updateMany({
      where: {
        id: messageId,
        status: "complete",
        conversation: { classroomId, userId: actor.id },
      },
      data: { reported: true },
    });
    if (!result.count) throw new AppError(404, m.notFound);
    return { reported: true };
  });
}
export async function clearTutor(actor: Actor, classroomId: string) {
  return getDatabase().$transaction(async (db) => {
    await lockLearningActor(db, actor, classroomId);
    if (
      await db.tutorMessage.count({
        where: {
          conversation: { classroomId, userId: actor.id },
          status: { in: ["queued", "generating"] },
          createdAt: { gt: new Date(Date.now() - lifetime) },
        },
      })
    )
      throw new AppError(409, m.busy);
    await db.tutorConversation.deleteMany({
      where: { classroomId, userId: actor.id },
    });
    return { cleared: true };
  });
}
export async function readTutorReports(actor: Actor, classroomId: string) {
  await ownedClassroom(actor, classroomId, false);
  const curriculum = await getDatabase().curriculum.findUnique({
    where: { classroomId },
    select: { approvedSourceIds: true },
  });
  const rows = await getDatabase().tutorMessage.findMany({
    where: {
      reported: true,
      conversation: { classroomId, classroom: { teacherId: actor.id } },
    },
    select: { id: true, question: true, answer: true, citations: true },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => {
    const citations = z.array(citationSchema).parse(row.citations);
    const revoked = citations.some(
      (c) => !curriculum?.approvedSourceIds.includes(c.sourceId),
    );
    return {
      ...row,
      answer: revoked ? m.citationRemoved : row.answer,
      citations: revoked ? [] : citations,
    };
  });
}
export type TutorView = Awaited<ReturnType<typeof readTutor>>;
