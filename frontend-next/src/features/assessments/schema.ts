import { z } from "zod";
const key = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const option = z
  .object({ id: key, text: z.string().trim().min(1).max(1000) })
  .strict();
export const questionTypes = [
  "mcq",
  "multi_select",
  "numerical",
  "ordering",
  "matching",
  "short_answer",
  "explanation",
  "coding",
] as const;
export const questionShape = z
  .object({
    id: key,
    type: z.enum(questionTypes),
    prompt: z.string().trim().min(1).max(4000),
    conceptIds: z.array(z.string().cuid()).min(1).max(5),
    difficulty: z.enum(["easy", "medium", "hard"]),
    marks: z.number().int().min(1).max(100),
    options: z.array(option).max(8),
    matchPrompts: z.array(option).max(8),
    answerIds: z.array(key).max(8),
    numericAnswer: z.number().finite().nullable(),
    tolerance: z.number().min(0).max(1_000_000),
    rubric: z.string().trim().max(4000),
    explanation: z.string().trim().min(1).max(4000),
    hint: z.string().trim().max(2000),
  })
  .strict();
export const assessmentShape = z
  .object({
    title: z.string().trim().min(1).max(160),
    instructions: z.string().trim().max(4000),
    maxAttempts: z.number().int().min(1).max(5),
    showSolutions: z.boolean(),
    questions: z.array(questionShape).max(30),
  })
  .strict();
export const assessmentSchema = assessmentShape.superRefine((document, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (
    new Set(document.questions.map((q) => q.id)).size !==
    document.questions.length
  )
    issue("Question IDs must be unique.");
  for (const q of document.questions) {
    if (new Set(q.conceptIds).size !== q.conceptIds.length)
      issue("Choose each concept once.");
    const options = new Set(q.options.map((o) => o.id));
    if (options.size !== q.options.length) issue("Option IDs must be unique.");
    if (["mcq", "multi_select", "ordering", "matching"].includes(q.type)) {
      if (q.options.length < 2 || q.answerIds.some((id) => !options.has(id)))
        issue(
          "Choice questions need at least two options and valid answer IDs.",
        );
      if (q.type === "mcq" && q.answerIds.length !== 1)
        issue("A single-choice question needs one correct answer.");
      if (
        q.type === "multi_select" &&
        (!q.answerIds.length ||
          new Set(q.answerIds).size !== q.answerIds.length)
      )
        issue("Choose distinct correct answers.");
      if (
        q.type === "ordering" &&
        (q.answerIds.length !== options.size ||
          new Set(q.answerIds).size !== options.size)
      )
        issue("Ordering answers must include each option exactly once.");
      if (
        q.type === "matching" &&
        (q.matchPrompts.length < 2 ||
          q.matchPrompts.length !== q.answerIds.length ||
          new Set(q.matchPrompts.map((o) => o.id)).size !==
            q.matchPrompts.length)
      )
        issue("Provide a valid answer for every matching prompt.");
    }
    if (q.type === "numerical" && q.numericAnswer === null)
      issue("Numerical questions need a numeric answer.");
    if (["short_answer", "explanation", "coding"].includes(q.type) && !q.rubric)
      issue("Written and coding questions need a teacher review rubric.");
  }
  if (JSON.stringify(document).length > 300_000)
    issue("Keep the assessment under 300,000 characters.");
});
export const publishedAssessmentSchema = assessmentSchema.refine(
  (d) => d.questions.length > 0,
  "Add at least one question before publishing.",
);
export const createAssessmentSchema = z
  .object({ title: z.string().trim().min(1).max(160) })
  .strict();
export const saveAssessmentSchema = z
  .object({
    version: z.number().int().positive(),
    assessment: assessmentSchema,
  })
  .strict();
export const assessmentStatusSchema = z
  .object({
    version: z.number().int().positive(),
    action: z.enum(["publish", "unpublish", "archive"]),
  })
  .strict();
export const generationOptionsSchema = z
  .object({
    conceptIds: z.array(z.string().cuid()).min(1).max(10),
    easy: z.number().int().min(0).max(20),
    medium: z.number().int().min(0).max(20),
    hard: z.number().int().min(0).max(20),
  })
  .strict()
  .refine(
    (v) => v.easy + v.medium + v.hard >= 1 && v.easy + v.medium + v.hard <= 20,
    "Choose a total of 1–20 questions.",
  );
export const generateAssessmentSchema = z
  .object({
    version: z.number().int().positive(),
    options: generationOptionsSchema,
  })
  .strict();
export const responseSchema = z.union([
  z.string().max(10000),
  z.array(z.string().max(100)).max(8),
]);
export const submitSchema = z
  .object({
    responses: z
      .array(z.object({ questionId: key, response: responseSchema }).strict())
      .max(30),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.responses.map((r) => r.questionId)).size === v.responses.length,
    "Answer each question once.",
  );
export const hintSchema = z.object({ questionId: key }).strict();
export const reviewSchema = z
  .object({
    questionId: key,
    marks: z.number().min(0).max(100),
    feedback: z.string().trim().min(1).max(4000),
  })
  .strict();
export type AssessmentInput = z.infer<typeof assessmentShape>;
export type QuestionInput = z.infer<typeof questionShape>;
export type QuestionResponse = z.infer<typeof responseSchema>;
export type GenerationOptions = z.infer<typeof generationOptionsSchema>;
export function publicQuestion(q: QuestionInput) {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    conceptIds: q.conceptIds,
    difficulty: q.difficulty,
    marks: q.marks,
    options: q.options,
    matchPrompts: q.matchPrompts,
    rubric: q.rubric,
    hasHint: !!q.hint,
  };
}
export type PublicQuestion = ReturnType<typeof publicQuestion>;
