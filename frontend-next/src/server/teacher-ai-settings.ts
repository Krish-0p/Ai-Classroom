import "server-only";
import type { Actor } from "@/features/auth/schema";
import {
  teacherAiKeySchema,
  type TeacherAiStatus,
} from "@/features/ai-settings/schema";
import { getDatabase } from "@/db/client";
import { requireTeacher } from "./classrooms";
import { AppError } from "./errors";
import {
  aiCredentialStorageReady,
  encryptTeacherKey,
  decryptTeacherKey,
} from "./ai-credential-encryption";
import { GroqProvider } from "@/ai/providers/groq";
import { groqTextModel } from "@/ai/providers/config";
import type { AIProvider } from "@/ai/providers/provider";
import { teacherAiMessages as m } from "@/lib/teacher-ai-messages";

export async function readTeacherAiStatus(
  actor: Actor,
): Promise<TeacherAiStatus> {
  requireTeacher(actor);
  const setting = await getDatabase().teacherAISettings.findUnique({
    where: { teacherId: actor.id },
    select: { updatedAt: true },
  });
  return {
    configured: Boolean(setting),
    updatedAt: setting?.updatedAt.toISOString() ?? null,
    storageReady: aiCredentialStorageReady(),
  };
}
export async function saveTeacherAiKey(actor: Actor, input: unknown) {
  requireTeacher(actor);
  const parsed = teacherAiKeySchema.safeParse(input);
  if (!parsed.success) throw new AppError(400, m.invalid);
  const encryptedGroqKey = encryptTeacherKey(actor.id, parsed.data.key);
  await getDatabase().teacherAISettings.upsert({
    where: { teacherId: actor.id },
    create: { teacherId: actor.id, encryptedGroqKey },
    update: { encryptedGroqKey },
    select: { teacherId: true },
  });
  return readTeacherAiStatus(actor);
}
export async function removeTeacherAiKey(actor: Actor) {
  requireTeacher(actor);
  await getDatabase().teacherAISettings.deleteMany({
    where: { teacherId: actor.id },
  });
  return readTeacherAiStatus(actor);
}
export async function teacherTextProviders(
  teacherId: string,
  task: "primary" | "fast" = "primary",
): Promise<AIProvider[]> {
  const setting = await getDatabase().teacherAISettings.findFirst({
    where: { teacherId, teacher: { role: "teacher" } },
    select: { encryptedGroqKey: true },
  });
  if (!setting) throw new AppError(409, m.missing);
  const key = decryptTeacherKey(teacherId, setting.encryptedGroqKey);
  // A teacher's credential is never sent to an environment-overridden endpoint.
  return [new GroqProvider(key, groqTextModel(task), true)];
}
