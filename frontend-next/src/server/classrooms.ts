import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/features/auth/schema";
import type { ClassroomInput } from "@/features/classrooms/schema";
import { classroomIdSchema } from "@/features/classrooms/schema";
import { getDatabase } from "@/db/client";
import { AppError } from "@/server/errors";
import { messages } from "@/lib/messages";
import { sourceStorage } from "@/server/storage";

const publicFields = {
  id: true,
  name: true,
  description: true,
  academicLevel: true,
  language: true,
  durationWeeks: true,
  status: true,
  createdAt: true,
  teacher: { select: { name: true } },
} as const;
export function requireTeacher(actor: Actor) {
  if (actor.role !== "teacher") throw new AppError(403, messages.forbidden);
}
export function generateJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
}
function validId(id: string) {
  if (!classroomIdSchema.safeParse(id).success)
    throw new AppError(404, messages.notFound);
}
export async function listClassrooms(actor: Actor) {
  return getDatabase().classroom.findMany({
    where:
      actor.role === "teacher"
        ? { teacherId: actor.id }
        : { enrollments: { some: { studentId: actor.id } } },
    select: {
      ...publicFields,
      ...(actor.role === "teacher"
        ? { joinCode: true, _count: { select: { enrollments: true } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
export async function readClassroom(actor: Actor, id: string) {
  validId(id);
  if (actor.role === "teacher") {
    const classroom = await getDatabase().classroom.findFirst({
      where: { id, teacherId: actor.id },
      select: {
        ...publicFields,
        joinCode: true,
        enrollments: {
          select: {
            joinedAt: true,
            student: { select: { id: true, name: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    if (!classroom) throw new AppError(404, messages.notFound);
    return classroom;
  }
  const classroom = await getDatabase().classroom.findFirst({
    where: { id, enrollments: { some: { studentId: actor.id } } },
    select: publicFields,
  });
  if (!classroom) throw new AppError(404, messages.notFound);
  return { ...classroom, joinCode: undefined, enrollments: undefined };
}
export async function createClassroom(actor: Actor, input: ClassroomInput) {
  requireTeacher(actor);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await getDatabase().classroom.create({
        data: { ...input, teacherId: actor.id, joinCode: generateJoinCode() },
        select: { id: true },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
    }
  }
  throw new AppError(503, messages.codeUnavailable);
}
export async function updateClassroom(
  actor: Actor,
  id: string,
  input: ClassroomInput,
) {
  requireTeacher(actor);
  validId(id);
  const result = await getDatabase().classroom.updateMany({
    where: { id, teacherId: actor.id },
    data: input,
  });
  if (!result.count) throw new AppError(404, messages.notFound);
  return readClassroom(actor, id);
}
export async function deleteClassroom(actor: Actor, id: string) {
  requireTeacher(actor);
  validId(id);
  const keys = await getDatabase().$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Classroom" WHERE id = ${id} AND "teacherId" = ${actor.id} FOR UPDATE`;
    if (!rows.length) throw new AppError(404, messages.notFound);
    const sources = await transaction.sourceDocument.findMany({
      where: { classroomId: id },
      select: { storageKey: true },
    });
    await transaction.classroom.delete({ where: { id } });
    return sources.map((source) => source.storageKey);
  });
  for (const key of keys)
    await sourceStorage
      .remove(key)
      .catch(() => console.error("Source file cleanup failed"));
}
export async function joinClassroom(actor: Actor, code: string) {
  if (actor.role !== "student") throw new AppError(403, messages.forbidden);
  return getDatabase().$transaction(async (transaction) => {
    // Lock the classroom so archive/deletion cannot race an enrollment.
    const rows = await transaction.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Classroom" WHERE "joinCode" = ${code} AND status = 'active' FOR UPDATE`;
    const classroom = rows[0];
    if (!classroom) throw new AppError(404, messages.joinUnavailable);
    await transaction.enrollment.upsert({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId: actor.id,
        },
      },
      create: { classroomId: classroom.id, studentId: actor.id },
      update: {},
    });
    return { id: classroom.id };
  });
}
