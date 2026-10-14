import "server-only";
import type { Actor } from "@/features/auth/schema";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/db/client";
import { requireTeacher } from "@/server/classrooms";
import { AppError } from "@/server/errors";
import { messages } from "@/lib/messages";
import { curriculumMessages as m } from "@/lib/curriculum-messages";

export async function ownedClassroom(
  actor: Actor,
  classroomId: string,
  requireActive = true,
) {
  requireTeacher(actor);
  const classroom = await getDatabase().classroom.findFirst({
    where: { id: classroomId, teacherId: actor.id },
  });
  if (!classroom) throw new AppError(404, messages.notFound);
  if (requireActive && classroom.status !== "active")
    throw new AppError(409, m.archived);
  return classroom;
}
export async function lockOwnedClassroom(
  transaction: Prisma.TransactionClient,
  actor: Actor,
  classroomId: string,
) {
  requireTeacher(actor);
  const rows = await transaction.$queryRaw<
    { status: string }[]
  >`SELECT status FROM "Classroom" WHERE id = ${classroomId} AND "teacherId" = ${actor.id} FOR UPDATE`;
  if (!rows[0]) throw new AppError(404, messages.notFound);
  if (rows[0].status !== "active") throw new AppError(409, m.archived);
}
