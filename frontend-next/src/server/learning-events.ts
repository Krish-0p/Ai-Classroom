import "server-only";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/features/auth/schema";
import { publishedLessonSchema } from "@/features/lessons/schema";
import { AppError } from "./errors";
import { tutorMessages as m } from "@/lib/tutor-messages";
export const lessonEventSchema = z
  .object({
    type: z.enum([
      "lesson_started",
      "lesson_completed",
      "block_viewed",
      "checkpoint_answered",
    ]),
    lessonId: z.string().cuid(),
    version: z.number().int().positive(),
    blockId: z.string().max(64).optional(),
  })
  .strict()
  .refine(
    (input) =>
      ["block_viewed", "checkpoint_answered"].includes(input.type)
        ? !!input.blockId
        : input.blockId === undefined,
    "Block IDs are required only for block and checkpoint events.",
  );
export async function recordLearningEvent(
  db: Prisma.TransactionClient,
  input: {
    classroomId: string;
    userId: string;
    type: string;
    resourceId: string;
    dedupeKey: string;
    payload?: Prisma.InputJsonValue;
  },
) {
  await db.learningEvent.createMany({
    data: [{ ...input, payload: input.payload ?? {} }],
    skipDuplicates: true,
  });
}
export async function lockLearningActor(
  db: Prisma.TransactionClient,
  actor: Actor,
  classroomId: string,
) {
  const rows = await db.$queryRaw<
    { status: string }[]
  >`SELECT cl.status FROM "Classroom" cl WHERE cl.id=${classroomId} AND (cl."teacherId"=${actor.id} OR EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."classroomId"=cl.id AND e."studentId"=${actor.id})) FOR UPDATE OF cl`;
  if (!rows.length) throw new AppError(404, m.notFound);
  if (rows[0].status !== "active") throw new AppError(409, m.archived);
}
export async function recordLessonActivity(
  actor: Actor,
  classroomId: string,
  input: z.infer<typeof lessonEventSchema>,
) {
  if (actor.role !== "student") throw new AppError(403, m.notFound);
  await getDatabase().$transaction(async (db) => {
    await lockLearningActor(db, actor, classroomId);
    const lesson = await db.lesson.findFirst({
      where: {
        id: input.lessonId,
        classroomId,
        status: "published",
        publishedVersion: input.version,
      },
    });
    if (!lesson) throw new AppError(404, m.notFound);
    const document = publishedLessonSchema.parse(lesson.published);
    const block = document.blocks.find((block) => block.id === input.blockId);
    if (
      (input.type === "block_viewed" && !block) ||
      (input.type === "checkpoint_answered" && block?.type !== "checkpoint")
    )
      throw new AppError(400, m.notFound);
    if (input.type === "lesson_completed") {
      const count = await db.learningEvent.count({
        where: {
          classroomId,
          userId: actor.id,
          type: "block_viewed",
          resourceId: lesson.id,
          dedupeKey: {
            in: document.blocks.map(
              (block) =>
                `block_viewed:${lesson.id}:${input.version}:${block.id}`,
            ),
          },
        },
      });
      if (count !== document.blocks.length)
        throw new AppError(409, m.eventError);
    }
    await recordLearningEvent(db, {
      classroomId,
      userId: actor.id,
      type: input.type,
      resourceId: lesson.id,
      dedupeKey: `${input.type}:${lesson.id}:${input.version}:${input.blockId ?? ""}`,
      payload: {
        version: input.version,
        conceptId: lesson.conceptId,
        ...(input.blockId ? { blockId: input.blockId } : {}),
      },
    });
  });
  return { saved: true };
}
