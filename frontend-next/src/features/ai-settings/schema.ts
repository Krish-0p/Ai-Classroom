import { z } from "zod";
import { teacherAiMessages as m } from "@/lib/teacher-ai-messages";

export const teacherAiKeySchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(20, m.invalid)
      .max(256, m.invalid)
      .regex(/^gsk_[A-Za-z0-9_-]+$/, m.invalid),
  })
  .strict();

export type TeacherAiStatus = {
  configured: boolean;
  storageReady: boolean;
  updatedAt: string | null;
};
