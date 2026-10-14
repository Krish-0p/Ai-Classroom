import { describe, expect, it } from "vitest";
import { chunkSource, sourceFingerprint } from "@/ai/rag/chunking";
import { tutorPrompt } from "@/ai/prompts/tutor";
import { lessonEventSchema } from "@/server/learning-events";

describe("tutor evidence boundaries", () => {
  it("preserves long source text and section references without inventing pages", () => {
    const text = "x".repeat(4001);
    const chunks = chunkSource(
      { sections: [{ label: "Slide 4", text }] },
      "unused",
    );
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(text);
    expect(chunks.every((chunk) => chunk.text.length <= 1800)).toBe(true);
    expect(chunks.every((chunk) => chunk.label.startsWith("Slide 4"))).toBe(
      true,
    );
    expect(chunkSource(null, "Plain text")[0].label).toContain("Document");
  });
  it("invalidates embedding caches when content or model changes", () => {
    const fingerprint = sourceFingerprint("source-one", "model-one");
    expect(sourceFingerprint("source-one", "model-one")).toBe(fingerprint);
    expect(sourceFingerprint("source-two", "model-one")).not.toBe(fingerprint);
    expect(sourceFingerprint("source-one", "model-two")).not.toBe(fingerprint);
  });
  it("rejects fabricated citations and supported answers without evidence", () => {
    const { schema } = tutorPrompt(
      "Explain FIFO",
      "English",
      [
        {
          id: "chunk-one",
          sourceId: "source-one",
          filename: "Notes",
          label: "Page 2",
          text: "Queues process items in arrival order.",
        },
      ],
      null,
    );
    expect(
      schema.safeParse({
        answer: "FIFO",
        sufficient: true,
        citationIds: ["chunk-one"],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        answer: "FIFO",
        sufficient: true,
        citationIds: ["foreign-chunk"],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ answer: "FIFO", sufficient: true, citationIds: [] })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({
        answer: "Insufficient sources",
        sufficient: false,
        citationIds: [],
      }).success,
    ).toBe(true);
  });
  it("prevents arbitrary client identifiers from multiplying completion events", () => {
    const base = { lessonId: "cm00000000000000000000000", version: 1 };
    expect(
      lessonEventSchema.safeParse({ ...base, type: "lesson_completed" })
        .success,
    ).toBe(true);
    expect(
      lessonEventSchema.safeParse({
        ...base,
        type: "lesson_completed",
        blockId: "invented",
      }).success,
    ).toBe(false);
    expect(
      lessonEventSchema.safeParse({ ...base, type: "block_viewed" }).success,
    ).toBe(false);
    expect(
      lessonEventSchema.safeParse({ ...base, type: "assessment_submitted" })
        .success,
    ).toBe(false);
  });
});
