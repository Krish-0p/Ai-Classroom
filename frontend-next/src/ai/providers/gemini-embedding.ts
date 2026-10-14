import "server-only";
import { z } from "zod";
import type { EmbeddingProvider } from "./embedding";
import { providerRequest } from "./http";
import { ProviderError } from "./provider";
import { providerBaseURL } from "./config";
const responseSchema = z.object({
  embeddings: z.array(
    z.object({ values: z.array(z.number().finite()).length(768) }),
  ),
  usageMetadata: z
    .object({ promptTokenCount: z.number().optional() })
    .optional(),
});
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private key: string,
    public readonly model: string,
  ) {}
  async embed(
    texts: string[],
    task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
    correlationId: string,
  ) {
    if (!texts.length || texts.length > 16) throw new ProviderError();
    const base = providerBaseURL("gemini");
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const raw = await providerRequest(
          `${base}/models/${encodeURIComponent(this.model)}:batchEmbedContents`,
          { "x-goog-api-key": this.key },
          {
            requests: texts.map((text) => ({
              model: `models/${this.model}`,
              content: { parts: [{ text }] },
              embedContentConfig: { taskType: task, outputDimensionality: 768 },
            })),
          },
        );
        const parsed = responseSchema.safeParse(raw);
        if (!parsed.success || parsed.data.embeddings.length !== texts.length)
          throw new ProviderError();
        const vectors = parsed.data.embeddings.map((item) => {
          const norm = Math.hypot(...item.values);
          if (!Number.isFinite(norm) || norm === 0) throw new ProviderError();
          return item.values.map((value) => value / norm);
        });
        console.info("AI embedding", {
          task: "EMBEDDING",
          jobId: correlationId,
          provider: "gemini",
          model: this.model,
          latencyMs: Date.now() - started,
          attempt,
          schemaValid: true,
          tokens: parsed.data.usageMetadata?.promptTokenCount,
        });
        return vectors;
      } catch (error) {
        console.info("AI embedding", {
          task: "EMBEDDING",
          jobId: correlationId,
          provider: "gemini",
          model: this.model,
          latencyMs: Date.now() - started,
          attempt,
          schemaValid: false,
        });
        if (
          !(error instanceof ProviderError && error.retryable) ||
          attempt === 2
        )
          throw new ProviderError();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    throw new ProviderError();
  }
}
