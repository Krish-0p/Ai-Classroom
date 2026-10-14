import { createHash } from "node:crypto";
import { z } from "zod";
const sectionsSchema = z.object({
  sections: z.array(z.object({ label: z.string(), text: z.string() })),
});
export const CHUNK_VERSION = "sections-v1";
export function sourceFingerprint(contentHash: string, model: string) {
  return createHash("sha256")
    .update(JSON.stringify([contentHash, model, 768, CHUNK_VERSION]))
    .digest("hex");
}
export function chunkSource(metadata: unknown, fallback: string) {
  const parsed = sectionsSchema.safeParse(metadata);
  const sections = parsed.success
    ? parsed.data.sections
    : [{ label: "Document", text: fallback }];
  const chunks: { label: string; text: string }[] = [];
  for (const section of sections) {
    let rest = section.text.trim();
    let part = 0;
    while (rest) {
      let end = Math.min(1800, rest.length);
      if (end < rest.length) {
        const boundary = Math.max(
          rest.lastIndexOf("\n\n", end),
          rest.lastIndexOf(". ", end),
        );
        if (boundary > 900) end = boundary + 1;
      }
      chunks.push({
        label: `${section.label} · ${++part}`,
        text: rest.slice(0, end).trim(),
      });
      rest = rest.slice(end).trim();
    }
  }
  return chunks;
}
