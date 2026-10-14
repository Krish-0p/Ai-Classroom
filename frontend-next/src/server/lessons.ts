import "server-only";
import type { Actor } from "@/features/auth/schema";
import { getDatabase } from "@/db/client";
import {
  Prisma,
  type Lesson,
  type LessonBlock,
} from "@/generated/prisma/client";
import {
  lessonSchema,
  publishedLessonSchema,
  type LessonInput,
  type LessonAction,
} from "@/features/lessons/schema";
import { readClassroom } from "@/server/classrooms";
import { ownedClassroom, lockOwnedClassroom } from "@/server/curriculum-access";
import { AppError } from "@/server/errors";
import { lessonMessages as m } from "@/lib/lesson-messages";

export function lessonDocument(
  lesson: Pick<Lesson, "title" | "estimatedMinutes"> & {
    blocks: Pick<LessonBlock, "content">[];
  },
): LessonInput {
  return lessonSchema.parse({
    title: lesson.title,
    estimatedMinutes: lesson.estimatedMinutes,
    blocks: lesson.blocks.map((block) => block.content),
  });
}
export async function listLessons(actor: Actor, classroomId: string) {
  await readClassroom(actor, classroomId);
  const db = getDatabase();
  if (actor.role === "student") {
    const lessons = await db.lesson.findMany({
      where: {
        classroomId,
        status: "published",
        published: { not: Prisma.DbNull },
        classroom: { enrollments: { some: { studentId: actor.id } } },
      },
      select: {
        id: true,
        published: true,
        publishedVersion: true,
        concept: { select: { title: true } },
      },
      orderBy: [
        { unit: { order: "asc" } },
        { concept: { order: "asc" } },
        { createdAt: "asc" },
      ],
    });
    return lessons.map((lesson) => ({
      id: lesson.id,
      title: publishedLessonSchema.parse(lesson.published).title,
      estimatedMinutes: publishedLessonSchema.parse(lesson.published)
        .estimatedMinutes,
      status: "published" as const,
      version: lesson.publishedVersion,
      publishedVersion: lesson.publishedVersion,
      conceptTitle: lesson.concept.title,
    }));
  }
  const lessons = await db.lesson.findMany({
    where: { classroomId, classroom: { teacherId: actor.id } },
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      status: true,
      version: true,
      publishedVersion: true,
      concept: { select: { title: true } },
    },
    orderBy: [
      { unit: { order: "asc" } },
      { concept: { order: "asc" } },
      { createdAt: "asc" },
    ],
  });
  return lessons.map(({ concept, ...lesson }) => ({
    ...lesson,
    conceptTitle: concept.title,
  }));
}
export async function lessonConcepts(actor: Actor, classroomId: string) {
  await ownedClassroom(actor, classroomId, false);
  return getDatabase().concept.findMany({
    where: { classroomId, classroom: { teacherId: actor.id } },
    select: { id: true, title: true, unit: { select: { title: true } } },
    orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
  });
}
export async function createLesson(
  actor: Actor,
  classroomId: string,
  conceptId: string,
) {
  return getDatabase().$transaction(async (transaction) => {
    await lockOwnedClassroom(transaction, actor, classroomId);
    const concept = await transaction.concept.findFirst({
      where: { id: conceptId, classroomId, classroom: { teacherId: actor.id } },
    });
    if (!concept) throw new AppError(404, m.missingConcept);
    if ((await transaction.lesson.count({ where: { classroomId } })) >= 200)
      throw new AppError(413, m.draftLimit);
    return transaction.lesson.create({
      data: {
        classroomId,
        unitId: concept.unitId,
        conceptId,
        title: concept.title,
      },
      select: { id: true },
    });
  });
}
export async function readLesson(
  actor: Actor,
  classroomId: string,
  id: string,
) {
  await readClassroom(actor, classroomId);
  const db = getDatabase();
  if (actor.role === "student") {
    const lesson = await db.lesson.findFirst({
      where: {
        id,
        classroomId,
        status: "published",
        published: { not: Prisma.DbNull },
        classroom: { enrollments: { some: { studentId: actor.id } } },
      },
      select: {
        id: true,
        published: true,
        publishedVersion: true,
        concept: { select: { title: true } },
      },
    });
    if (!lesson) throw new AppError(404, m.notFound);
    return {
      kind: "student" as const,
      id: lesson.id,
      document: publishedLessonSchema.parse(lesson.published),
      version: lesson.publishedVersion,
      conceptTitle: lesson.concept.title,
    };
  }
  const lesson = await db.lesson.findFirst({
    where: { id, classroomId, classroom: { teacherId: actor.id } },
    include: {
      blocks: { orderBy: { order: "asc" } },
      concept: { select: { title: true } },
    },
  });
  if (!lesson) throw new AppError(404, m.notFound);
  const job = await db.generationJob.findFirst({
    where: { classroomId, lessonId: id, classroom: { teacherId: actor.id } },
    select: { id: true, status: true, progress: true, error: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    kind: "teacher" as const,
    id: lesson.id,
    document: lessonDocument(lesson),
    version: lesson.version,
    status: lesson.status,
    published: lesson.published
      ? publishedLessonSchema.parse(lesson.published)
      : null,
    publishedVersion: lesson.publishedVersion,
    conceptTitle: lesson.concept.title,
    job,
  };
}
export async function writeLessonBlocks(
  transaction: Prisma.TransactionClient,
  lessonId: string,
  document: LessonInput,
) {
  // Private draft blocks are normalized; published snapshots remain immutable until publication.
  await transaction.lessonBlock.deleteMany({ where: { lessonId } });
  if (document.blocks.length)
    await transaction.lessonBlock.createMany({
      data: document.blocks.map((block, order) => ({
        lessonId,
        key: block.id,
        type: block.type,
        order,
        content: block,
        locked: block.locked,
      })),
    });
}
export async function saveLesson(
  actor: Actor,
  classroomId: string,
  id: string,
  version: number,
  input: LessonInput,
) {
  const document = lessonSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    await lockOwnedClassroom(transaction, actor, classroomId);
    const lesson = await transaction.lesson.findFirst({
      where: { id, classroomId, classroom: { teacherId: actor.id } },
    });
    if (!lesson) throw new AppError(404, m.notFound);
    if (lesson.version !== version) throw new AppError(409, m.conflict);
    await writeLessonBlocks(transaction, id, document);
    return transaction.lesson.update({
      where: { id },
      data: {
        title: document.title,
        estimatedMinutes: document.estimatedMinutes,
        version: { increment: 1 },
        ...(lesson.status === "review" ? { status: "draft" } : {}),
      },
      select: { version: true },
    });
  });
}
export async function changeLessonStatus(
  actor: Actor,
  classroomId: string,
  id: string,
  version: number,
  action: LessonAction,
) {
  return getDatabase().$transaction(async (transaction) => {
    await lockOwnedClassroom(transaction, actor, classroomId);
    const lesson = await transaction.lesson.findFirst({
      where: { id, classroomId, classroom: { teacherId: actor.id } },
      include: { blocks: { orderBy: { order: "asc" } } },
    });
    if (!lesson) throw new AppError(404, m.notFound);
    if (lesson.version !== version) throw new AppError(409, m.conflict);
    if (action === "publish") {
      const parsed = publishedLessonSchema.safeParse(lessonDocument(lesson));
      if (!parsed.success) throw new AppError(400, m.emptyPublish);
      await transaction.lesson.update({
        where: { id },
        data: {
          status: "published",
          published: parsed.data,
          version: { increment: 1 },
          publishedVersion: version + 1,
          publishedAt: new Date(),
        },
      });
    } else if (action === "review") {
      if (lesson.status === "published")
        throw new AppError(409, m.unpublishedChanges);
      await transaction.lesson.update({
        where: { id },
        data: { status: "review", version: { increment: 1 } },
      });
    } else {
      await transaction.lesson.update({
        where: { id },
        data: {
          status: action === "archive" ? "archived" : "draft",
          version: { increment: 1 },
          published: Prisma.DbNull,
          publishedVersion: 0,
          publishedAt: null,
        },
      });
    }
    return { id, action, version: version + 1 };
  });
}
export async function deleteLesson(
  actor: Actor,
  classroomId: string,
  id: string,
) {
  return getDatabase().$transaction(async (transaction) => {
    await lockOwnedClassroom(transaction, actor, classroomId);
    const result = await transaction.lesson.deleteMany({
      where: { id, classroomId, classroom: { teacherId: actor.id } },
    });
    if (!result.count) throw new AppError(404, m.notFound);
  });
}
