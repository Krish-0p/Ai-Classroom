import "server-only";
import type { Actor } from "@/features/auth/schema";
import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/db/client";
import { curriculumSchema } from "@/features/curriculum/schema";
import { slideDeckSchema, type SlideDeckInput } from "@/features/slides/schema";
import { curriculumSlideOutline } from "@/features/slides/outline";
import { readClassroom } from "./classrooms";
import { lockOwnedClassroom } from "./curriculum-access";
import { AppError } from "./errors";
import { slideMessages as m } from "@/lib/slide-messages";

export async function approvedSlideCurriculum(
  db: Prisma.TransactionClient,
  classroomId: string,
) {
  const row = await db.curriculum.findUnique({ where: { classroomId } });
  if (!row?.approved) throw new AppError(409, m.missing);
  return {
    document: curriculumSchema.parse(row.approved),
    version: row.approvedVersion,
  };
}
export function validateSlideConcepts(
  deck: SlideDeckInput,
  conceptIds: string[],
) {
  const allowed = new Set(conceptIds);
  if (
    deck.slides.some((slide) => slide.conceptIds.some((id) => !allowed.has(id)))
  )
    throw new AppError(400, m.references);
}
export async function readSlides(actor: Actor, classroomId: string) {
  await readClassroom(actor, classroomId);
  const db = getDatabase();
  const scope =
    actor.role === "teacher"
      ? { teacherId: actor.id }
      : { enrollments: { some: { studentId: actor.id } } };
  const curriculum = await db.curriculum.findFirst({
    where: { classroomId, classroom: scope },
    select: { approved: true, approvedVersion: true },
  });
  const approved = curriculum?.approved
    ? curriculumSchema.parse(curriculum.approved)
    : null;
  if (actor.role === "student") {
    const row = await db.slideDeck.findFirst({
      where: { classroomId, classroom: scope },
      select: {
        published: true,
        publishedVersion: true,
        publishedCurriculumVersion: true,
        publishedAiGenerated: true,
      },
    });
    return {
      role: "student" as const,
      published: row?.published ? slideDeckSchema.parse(row.published) : null,
      publishedVersion: row?.publishedVersion ?? 0,
      publishedCurriculumVersion: row?.publishedCurriculumVersion ?? 0,
      aiGenerated: row?.publishedAiGenerated ?? false,
      concepts:
        approved?.units.flatMap((unit) =>
          unit.concepts.map(({ id, title }) => ({ id, title })),
        ) ?? [],
    };
  }
  await db.generationJob.updateMany({
    where: {
      classroomId,
      classroom: { teacherId: actor.id },
      task: "SLIDES_GENERATION",
      status: { in: ["queued", "generating"] },
      createdAt: { lt: new Date(Date.now() - 180_000) },
    },
    data: { status: "failed", error: m.failed },
  });
  const [row, job] = await Promise.all([
    db.slideDeck.findFirst({ where: { classroomId, classroom: scope } }),
    db.generationJob.findFirst({
      where: { classroomId, classroom: scope, task: "SLIDES_GENERATION" },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, progress: true, error: true },
    }),
  ]);
  return {
    role: "teacher" as const,
    draft: row
      ? slideDeckSchema.parse(row.draft)
      : approved
        ? curriculumSlideOutline(approved)
        : null,
    version: row?.version ?? 0,
    curriculumVersion: curriculum?.approvedVersion ?? 0,
    draftCurriculumVersion:
      row?.curriculumVersion ?? curriculum?.approvedVersion ?? 0,
    publishedVersion: row?.published ? row.publishedVersion : 0,
    aiGenerated: row?.aiGenerated ?? false,
    concepts:
      approved?.units.flatMap((unit) =>
        unit.concepts.map(({ id, title }) => ({ id, title })),
      ) ?? [],
    job,
  };
}
export async function saveSlides(
  actor: Actor,
  classroomId: string,
  version: number,
  deck: SlideDeckInput,
) {
  const document = slideDeckSchema.parse(deck);
  await getDatabase().$transaction(async (db) => {
    await lockOwnedClassroom(db, actor, classroomId);
    const curriculum = await approvedSlideCurriculum(db, classroomId);
    validateSlideConcepts(
      document,
      curriculum.document.units.flatMap((unit) =>
        unit.concepts.map((concept) => concept.id),
      ),
    );
    const current = await db.slideDeck.findUnique({ where: { classroomId } });
    if ((current?.version ?? 0) !== version)
      throw new AppError(409, m.conflict);
    await db.slideDeck.upsert({
      where: { classroomId },
      create: {
        classroomId,
        draft: document,
        curriculumVersion: curriculum.version,
      },
      update: {
        draft: document,
        curriculumVersion: curriculum.version,
        version: { increment: 1 },
      },
    });
  });
  return { version: version + 1 };
}
export async function setSlideStatus(
  actor: Actor,
  classroomId: string,
  version: number,
  action: "publish" | "unpublish",
) {
  return getDatabase().$transaction(async (db) => {
    await lockOwnedClassroom(db, actor, classroomId);
    const current = await db.slideDeck.findUnique({ where: { classroomId } });
    if (!current || current.version !== version)
      throw new AppError(409, m.conflict);
    if (action === "unpublish") {
      await db.slideDeck.update({
        where: { classroomId },
        data: {
          published: Prisma.DbNull,
          publishedVersion: 0,
          version: { increment: 1 },
        },
      });
    } else {
      const curriculum = await approvedSlideCurriculum(db, classroomId);
      if (current.curriculumVersion !== curriculum.version)
        throw new AppError(409, m.stale);
      const document = slideDeckSchema.parse(current.draft);
      validateSlideConcepts(
        document,
        curriculum.document.units.flatMap((unit) =>
          unit.concepts.map((concept) => concept.id),
        ),
      );
      await db.slideDeck.update({
        where: { classroomId },
        data: {
          published: document,
          publishedVersion: version + 1,
          publishedCurriculumVersion: curriculum.version,
          publishedAiGenerated: current.aiGenerated,
          version: { increment: 1 },
        },
      });
    }
    return { version: version + 1 };
  });
}

export type SlideTeacherView = Extract<
  Awaited<ReturnType<typeof readSlides>>,
  { role: "teacher" }
>;
