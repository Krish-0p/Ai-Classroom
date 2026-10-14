import { z } from "zod";
import { messages as m } from "@/lib/messages";

export const roleSchema = z.enum(["teacher", "student"], {
  error: m.invalidRole,
});
export type Role = z.infer<typeof roleSchema>;
export type Actor = { id: string; role: Role; name: string };
export const emailSchema = z.email(m.emailValidation).max(254).transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(12, m.passwordValidation).max(128, m.passwordValidation);
export const loginSchema = z.object({ email: emailSchema, password: passwordSchema });
export const registrationSchema = loginSchema.extend({
  name: z.string().trim().min(2, m.nameValidation).max(100, m.nameValidation),
  role: roleSchema,
});
