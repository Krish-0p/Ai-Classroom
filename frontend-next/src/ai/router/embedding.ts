import "server-only";
import type { EmbeddingProvider } from "@/ai/providers/embedding";
import { GeminiEmbeddingProvider } from "@/ai/providers/gemini-embedding";
import { ProviderError } from "@/ai/providers/provider";
export function embeddingProvider(): EmbeddingProvider {
  const key = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_EMBEDDING_MODEL;
  if (!key || !model) throw new ProviderError();
  return new GeminiEmbeddingProvider(key, model);
}
