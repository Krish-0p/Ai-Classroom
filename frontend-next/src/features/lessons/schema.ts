import { z } from "zod";
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const title = z.string().trim().min(1).max(160);
const body = z.string().trim().min(1).max(10_000);
const common = { id, title, locked: z.boolean() };
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("text"), body }).strict(),
  z.object({ ...common, type: z.literal("callout"), body }).strict(),
  z.object({ ...common, type: z.literal("example"), body }).strict(),
  z
    .object({
      ...common,
      type: z.literal("code"),
      language: z.string().trim().min(1).max(40),
      code: body,
      body,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("diagram"),
      body,
      nodes: z
        .array(z.object({ id, label: title }).strict())
        .min(1)
        .max(20),
      edges: z.array(z.object({ from: id, to: id }).strict()).max(40),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal("checkpoint"),
      prompt: body,
      answer: body,
    })
    .strict(),
]);
export const lessonShape = z
  .object({
    title,
    estimatedMinutes: z.number().int().min(1).max(180),
    blocks: z.array(blockSchema).max(40),
  })
  .strict();
export const lessonSchema = lessonShape.superRefine((lesson, context) => {
  const issue = (message: string) =>
    context.addIssue({ code: "custom", message });
  if (
    new Set(lesson.blocks.map((block) => block.id)).size !==
    lesson.blocks.length
  )
    issue("Block IDs must be unique.");
  for (const block of lesson.blocks)
    if (block.type === "diagram") {
      const ids = new Set(block.nodes.map((node) => node.id));
      if (
        ids.size !== block.nodes.length ||
        block.edges.some(
          (edge) =>
            !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to,
        )
      )
        issue("Diagram links must reference distinct existing nodes.");
    }
  if (JSON.stringify(lesson).length > 400_000)
    issue("Keep the lesson under 400,000 characters.");
});
export const publishedLessonSchema = lessonSchema.refine(
  (lesson) => lesson.blocks.length > 0,
  "Add at least one complete block before publishing.",
);
export const generatedLessonSchema = publishedLessonSchema.refine(
  (lesson) => lesson.blocks.length >= 3 && lesson.blocks.length <= 30,
  "Generate 3–30 lesson blocks.",
);
export const createLessonSchema = z
  .object({ conceptId: z.string().cuid() })
  .strict();
export const saveLessonSchema = z
  .object({ version: z.number().int().positive(), lesson: lessonSchema })
  .strict();
export const lessonStatusSchema = z
  .object({
    version: z.number().int().positive(),
    action: z.enum(["publish", "unpublish", "review", "archive"]),
  })
  .strict();
export const generateLessonSchema = z
  .object({
    version: z.number().int().positive(),
    instruction: z.string().trim().max(1000).default(""),
  })
  .strict();
export type LessonInput = z.infer<typeof lessonShape>;
export type LessonBlockInput = z.infer<typeof blockSchema>;
export type LessonAction = z.infer<typeof lessonStatusSchema>["action"];
