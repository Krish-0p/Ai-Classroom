import "server-only";
import { GeminiProvider } from "@/ai/providers/gemini";
import { GroqProvider } from "@/ai/providers/groq";
import {
  ProviderError,
  StructuredOutputError,
  parseStructured,
  type AIProvider,
  type GenerateStructuredInput,
  type ProviderName,
} from "@/ai/providers/provider";

export type GenerationMetadata = {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  tokens?: number;
  attempt: number;
  schemaValid: boolean;
  failureReason?: string;
  httpStatus?: number;
};
export function configuredProviders(
  task: "primary" | "fast" = "primary",
): AIProvider[] {
  const primary =
    (task === "fast"
      ? process.env.AI_FAST_PROVIDER
      : process.env.AI_PRIMARY_PROVIDER) ||
    (task === "fast" ? "groq" : "gemini");
  if (primary !== "gemini" && primary !== "groq") throw new ProviderError();
  const providers: AIProvider[] = [];
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_TEXT_MODEL)
    providers.push(
      new GeminiProvider(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_TEXT_MODEL,
      ),
    );
  const groqModel =
    task === "fast"
      ? process.env.GROQ_FAST_MODEL
      : process.env.GROQ_REASONING_MODEL;
  if (process.env.GROQ_API_KEY && groqModel)
    providers.push(new GroqProvider(process.env.GROQ_API_KEY, groqModel));
  return providers.sort(
    (a, b) => Number(b.name === primary) - Number(a.name === primary),
  );
}
export async function routeStructured<T>(
  input: GenerateStructuredInput<T>,
  providers = configuredProviders(),
  record: (metadata: GenerationMetadata) => void = (metadata) =>
    console.info("AI generation", metadata),
): Promise<T> {
  let lastFailure: unknown;
  for (const provider of providers) {
    let corrected = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const start = Date.now();
      let tokens: number | undefined;
      try {
        const response = await provider.generateText({
          ...input,
          prompt: corrected
            ? `${input.prompt}\nYour previous response was invalid. Return a complete JSON object matching the supplied schema exactly. Use unique IDs and valid references. Do not return markdown fences.`
            : input.prompt,
        });
        tokens = response.tokens;
        const value = parseStructured(response.text, input.schema);
        record({
          provider: provider.name,
          model: provider.model,
          latencyMs: Date.now() - start,
          tokens,
          attempt,
          schemaValid: true,
        });
        return value;
      } catch (error) {
        lastFailure = error;
        record({
          provider: provider.name,
          model: provider.model,
          latencyMs: Date.now() - start,
          tokens,
          attempt,
          schemaValid: false,
          failureReason:
            error instanceof ProviderError
              ? error.reason
              : error instanceof StructuredOutputError
                ? "schema"
                : "unknown",
          ...(error instanceof ProviderError && error.httpStatus
            ? { httpStatus: error.httpStatus }
            : {}),
        });
        if (error instanceof StructuredOutputError && !corrected)
          corrected = true;
        else if (!(error instanceof ProviderError && error.retryable)) break;
        if (attempt < 2)
          await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }
  if (
    lastFailure instanceof ProviderError ||
    lastFailure instanceof StructuredOutputError
  )
    throw lastFailure;
  throw new ProviderError();
}
