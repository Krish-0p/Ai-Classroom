import { z } from "zod";
export const indexSourceSchema = z
  .object({ sourceId: z.string().cuid() })
  .strict();
export const tutorQuestionSchema = z
  .object({
    question: z.string().trim().min(3).max(2000),
    requestId: z.string().uuid(),
    lessonId: z.string().cuid().optional(),
  })
  .strict();
export const citationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  filename: z.string(),
  label: z.string(),
  text: z.string(),
});
export type Citation = z.infer<typeof citationSchema>;
export const tutorResultSchema = z
  .object({
    answer: z.string().trim().min(1).max(8000),
    citationIds: z.array(z.string()).max(6),
    sufficient: z.boolean(),
  })
  .strict();
export const reportTutorSchema = z
  .object({ messageId: z.string().cuid() })
  .strict();
