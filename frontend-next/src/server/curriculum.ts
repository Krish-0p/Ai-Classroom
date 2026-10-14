import "server-only";
import type { Actor } from "@/features/auth/schema";
import {
  curriculumSchema,
  type CurriculumInput,
} from "@/features/curriculum/schema";
import { getDatabase } from "@/db/client";
import { readClassroom } from "@/server/classrooms";
import { lockOwnedClassroom } from "@/server/curriculum-access";
import { AppError } from "@/server/errors";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
import { lessonMessages } from "@/lib/lesson-messages";
import { assessmentMessages } from "@/lib/assessment-messages";
import { publishedAssessmentSchema } from "@/features/assessments/schema";

export async function readCurriculum(actor: Actor, classroomId: string) {
  await readClassroom(actor, classroomId);
  const db = getDatabase();
  // Select only published fields for enrolled students; never serialize the draft.
  if (actor.role === "student") {
    const row = await db.curriculum.findFirst({
      where: {
        classroomId,
        classroom: { enrollments: { some: { studentId: actor.id } } },
      },
      select: { approved: true, approvedVersion: true, approvedAt: true },
    });
    return {
      approved: row?.approved ? curriculumSchema.parse(row.approved) : null,
      approvedVersion: row?.approvedVersion ?? 0,
      approvedAt: row?.approvedAt ?? null,
    };
  }
  const [row, sources, job] = await Promise.all([
    db.curriculum.findFirst({
      where: { classroomId, classroom: { teacherId: actor.id } },
    }),
    db.sourceDocument.findMany({
      where: { classroomId, classroom: { teacherId: actor.id } },
      select: {
        id: true,
        filename: true,
        processingStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.generationJob.findFirst({
      where: {
        classroomId,
        task: "CURRICULUM_EXTRACTION",
        classroom: { teacherId: actor.id },
      },
      select: {
        id: true,
        status: true,
        progress: true,
        error: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    draft: row?.draft ? curriculumSchema.parse(row.draft) : null,
    draftVersion: row?.draftVersion ?? 0,
    sourceIds: row?.sourceIds ?? [],
    approved: row?.approved ? curriculumSchema.parse(row.approved) : null,
    approvedVersion: row?.approvedVersion ?? 0,
    approvedAt: row?.approvedAt ?? null,
    sources,
    job,
  };
}
export async function saveCurriculum(
  actor: Actor,
  classroomId: string,
  version: number,
  input: CurriculumInput,
  sourceIds?: string[],
) {
  const curriculum = curriculumSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    await lockOwnedClassroom(transaction, actor, classroomId);
    const row = await transaction.curriculum.findUnique({
      where: { classroomId },
    });
    if (
      sourceIds &&
      (await transaction.sourceDocument.count({
        where: { classroomId, id: { in: sourceIds } },
      })) !== sourceIds.length
    )
      throw new AppError(404, m.sourceMissing);
    if ((row?.draftVersion ?? 0) !== version)
      throw new AppError(409, m.conflict);
    return transaction.curriculum.upsert({
      where: { classroomId },
      create: {
        classroomId,
        draft: curriculum,
        draftVersion: 1,
        sourceIds: sourceIds ?? [],
      },
      update: {
        draft: curriculum,
        draftVersion: { increment: 1 },
        ...(sourceIds ? { sourceIds } : {}),
      },
      select: { draftVersion: true },
    });
  });
}
export async function approveCurriculum(
  actor: Actor,
  classroomId: string,
  version: number,
) {
  return getDatabase().$transaction(
    async (transaction) => {
      await lockOwnedClassroom(transaction, actor, classroomId);
      const row = await transaction.curriculum.findUnique({
        where: { classroomId },
      });
      if (!row?.draft || row.draftVersion !== version)
        throw new AppError(409, m.conflict);
      const curriculum = curriculumSchema.parse(row.draft);
      const approvedKeys = curriculum.units.flatMap((unit) =>
        unit.concepts.map((concept) => concept.id),
      );
      const removed = await transaction.concept.findMany({
        where: { classroomId, key: { notIn: approvedKeys } },
        select: { id: true },
      });
      const removedIds = removed.map((concept) => concept.id);
      if (removedIds.length) {
        // Saved drafts can differ from the publication students still use.
        const publications = await transaction.assessment.findMany({
          where: { classroomId, status: "published" },
          select: { published: true },
        });
        const removedSet = new Set(removedIds);
        if (
          publications.some((assessment) =>
            publishedAssessmentSchema
              .parse(assessment.published)
              .questions.some((question) =>
                question.conceptIds.some((id) => removedSet.has(id)),
              ),
          )
        )
          throw new AppError(409, assessmentMessages.conceptInUse);
      }
      if (
        removedIds.length &&
        ((await transaction.questionConcept.count({
          where: { conceptId: { in: removedIds } },
        })) ||
          (await transaction.questionAttempt.count({
            where: {
              conceptIds: { hasSome: removedIds },
              attempt: { assessment: { classroomId } },
            },
          })))
      )
        throw new AppError(409, assessmentMessages.conceptInUse);
      if (
        await transaction.lesson.count({
          where: { classroomId, concept: { key: { notIn: approvedKeys } } },
        })
      )
        throw new AppError(409, lessonMessages.conceptInUse);
      const conceptIds = new Map<string, string>();
      const existingConcepts = await transaction.concept.findMany({
        where: { classroomId },
        select: { id: true },
      });
      await transaction.conceptDependency.deleteMany({
        where: {
          conceptId: { in: existingConcepts.map((concept) => concept.id) },
        },
      });
      for (const [order, unit] of curriculum.units.entries()) {
        const storedUnit = await transaction.courseUnit.upsert({
          where: { classroomId_key: { classroomId, key: unit.id } },
          create: {
            classroomId,
            key: unit.id,
            title: unit.title,
            description: unit.description,
            order,
          },
          update: { title: unit.title, description: unit.description, order },
        });
        for (const [conceptOrder, concept] of unit.concepts.entries()) {
          const stored = await transaction.concept.upsert({
            where: { classroomId_key: { classroomId, key: concept.id } },
            create: {
              classroomId,
              unitId: storedUnit.id,
              key: concept.id,
              title: concept.title,
              description: concept.description,
              order: conceptOrder,
            },
            update: {
              unitId: storedUnit.id,
              title: concept.title,
              description: concept.description,
              order: conceptOrder,
            },
          });
          conceptIds.set(concept.id, stored.id);
          await transaction.lesson.updateMany({
            where: { classroomId, conceptId: stored.id },
            data: { unitId: storedUnit.id },
          });
        }
      }
      await transaction.concept.deleteMany({
        where: { classroomId, key: { notIn: [...conceptIds.keys()] } },
      });
      await transaction.courseUnit.deleteMany({
        where: {
          classroomId,
          key: { notIn: curriculum.units.map((unit) => unit.id) },
        },
      });
      const edges = curriculum.units.flatMap((unit) =>
        unit.concepts.flatMap((concept) =>
          concept.prerequisiteIds.map((parent) => ({
            conceptId: conceptIds.get(concept.id)!,
            prerequisiteConceptId: conceptIds.get(parent)!,
          })),
        ),
      );
      if (edges.length)
        await transaction.conceptDependency.createMany({ data: edges });
      return transaction.curriculum.update({
        where: { classroomId },
        data: {
          approved: curriculum,
          approvedVersion: version,
          approvedSourceIds: row.sourceIds,
          approvedAt: new Date(),
          approvedBy: actor.id,
        },
        select: { approvedVersion: true },
      });
    },
    { timeout: 20_000 },
  );
}
