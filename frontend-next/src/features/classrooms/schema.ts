import { z } from "zod";
import { messages as m } from "@/lib/messages";

export const classroomSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, m.courseValidation)
      .max(120, m.courseValidation),
    description: z
      .string()
      .trim()
      .max(2000, m.descriptionValidation)
      .default(""),
    academicLevel: z
      .string()
      .trim()
      .min(2, m.levelValidation)
      .max(100, m.levelValidation),
    language: z
      .string()
      .trim()
      .min(2, m.languageValidation)
      .max(80, m.languageValidation),
    durationWeeks: z
      .number()
      .int(m.durationValidation)
      .min(1, m.durationValidation)
      .max(104, m.durationValidation),
    status: z.enum(["active", "archived"]).default("active"),
  })
  .strict();
export const joinSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NP-Z2-9]{8}$/, m.codeValidation),
  })
  .strict();
export const classroomIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/);
export type ClassroomInput = z.infer<typeof classroomSchema>;
