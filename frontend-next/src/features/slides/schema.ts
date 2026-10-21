import { z } from "zod";

export const slideShape = z
  .object({
    heading: z.string().trim().min(1).max(160),
    explanation: z.string().trim().min(1).max(650),
    bullets: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
    example: z.string().trim().max(450),
    takeaway: z.string().trim().min(1).max(240),
    conceptIds: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).max(12),
  })
  .strict();
export const slideDeckShape = z
  .object({
    title: z.string().trim().min(1).max(160),
    slides: z.array(slideShape).min(4).max(5),
  })
  .strict();
export const slideDeckSchema = slideDeckShape.superRefine((deck, context) => {
  if (
    deck.slides.some(
      (slide) => new Set(slide.conceptIds).size !== slide.conceptIds.length,
    )
  )
    context.addIssue({
      code: "custom",
      message: "Choose each concept only once per slide.",
    });
});
export const saveSlidesSchema = z
  .object({
    version: z.number().int().nonnegative(),
    deck: slideDeckSchema,
  })
  .strict();
export const generateSlidesSchema = z
  .object({
    version: z.number().int().nonnegative(),
    count: z.union([z.literal(4), z.literal(5)]),
    instruction: z.string().trim().max(500),
  })
  .strict();
export const slideStatusSchema = z
  .object({
    version: z.number().int().positive(),
    action: z.enum(["publish", "unpublish"]),
  })
  .strict();
export type SlideDeckInput = z.infer<typeof slideDeckShape>;
export type SlideInput = z.infer<typeof slideShape>;
export type GenerateSlidesInput = z.infer<typeof generateSlidesSchema>;
