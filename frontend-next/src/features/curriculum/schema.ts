import { z } from "zod";

const key = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/, "Use a lowercase topic ID.");
const title = z.string().trim().min(1).max(160);
export const curriculumShape = z
  .object({
    courseTitle: title,
    learningOutcomes: z.array(z.string().trim().min(1).max(500)).max(30),
    units: z
      .array(
        z
          .object({
            id: key,
            title,
            description: z.string().trim().max(2000),
            concepts: z
              .array(
                z
                  .object({
                    id: key,
                    title,
                    description: z.string().trim().max(2000),
                    prerequisiteIds: z.array(key).max(30),
                  })
                  .strict(),
              )
              .min(1)
              .max(50),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export const curriculumSchema = curriculumShape.superRefine(
  (value, context) => {
    const concepts = value.units.flatMap((unit) => unit.concepts);
    const ids = new Set(concepts.map((concept) => concept.id));
    const issue = (message: string) =>
      context.addIssue({ code: "custom", message });
    if (concepts.length > 200) issue("Limit the curriculum to 200 concepts.");
    if (ids.size !== concepts.length)
      issue("Concept IDs must be unique across units.");
    if (new Set(value.units.map((unit) => unit.id)).size !== value.units.length)
      issue("Unit IDs must be unique.");
    for (const concept of concepts) {
      if (
        new Set(concept.prerequisiteIds).size !== concept.prerequisiteIds.length
      )
        issue("Remove duplicate prerequisites.");
      if (
        concept.prerequisiteIds.some((id) => !ids.has(id) || id === concept.id)
      )
        issue(
          "Prerequisites must reference another concept in this curriculum.",
        );
    }
    const nodes = new Map(
      concepts.map((concept) => [concept.id, concept.prerequisiteIds]),
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(id: string): boolean {
      if (visiting.has(id)) return false;
      if (visited.has(id)) return true;
      visiting.add(id);
      if ((nodes.get(id) ?? []).some((parent) => !visit(parent))) return false;
      visiting.delete(id);
      visited.add(id);
      return true;
    }
    if (concepts.some((concept) => !visit(concept.id)))
      issue("Prerequisites cannot form a cycle.");
  },
);
export type CurriculumInput = z.infer<typeof curriculumShape>;
export const saveDraftSchema = z
  .object({
    version: z.number().int().nonnegative(),
    curriculum: curriculumSchema,
    sourceIds: z
      .array(z.string().cuid())
      .max(30)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Choose each source once.",
      )
      .optional(),
  })
  .strict();
export const approveSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
export const sourceIdsSchema = z
  .array(z.string().cuid())
  .min(1)
  .max(10)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Choose each source once.",
  );
export const generateSchema = z.object({ sourceIds: sourceIdsSchema }).strict();
export const pasteSchema = z
  .object({
    filename: z.string().trim().min(1).max(160),
    text: z.string().trim().min(20).max(120_000),
  })
  .strict();
