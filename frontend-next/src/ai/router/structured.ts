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
  providerCode?: string;
  retryAfterSeconds?: number;
  validationIssues?: { path: string; code: string }[];
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
  const fallback = process.env.AI_PROVIDER_FALLBACK_ENABLED || "true";
  if (fallback !== "true" && fallback !== "false")
    throw new ProviderError(false, "configuration");
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
  return providers
    .filter((provider) => fallback === "true" || provider.name === primary)
    .sort((a, b) => Number(b.name === primary) - Number(a.name === primary));
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
    let correction = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const start = Date.now();
      let tokens: number | undefined;
      try {
        const response = await provider.generateText({
          ...input,
          prompt: corrected
            ? `${input.prompt}\nYour previous response was invalid. Fix these validation issues: ${correction}. Return a complete JSON object matching the supplied schema exactly. Use unique IDs and valid references. Do not return markdown fences.`
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
          ...(error instanceof ProviderError && error.providerCode
            ? { providerCode: error.providerCode }
            : {}),
          ...(error instanceof ProviderError && error.retryAfterMs !== undefined
            ? { retryAfterSeconds: Math.ceil(error.retryAfterMs / 1000) }
            : {}),
          ...(error instanceof StructuredOutputError
            ? {
                validationIssues: error.issues.map(({ path, code }) => ({
                  path,
                  code,
                })),
              }
            : {}),
        });
        if (error instanceof StructuredOutputError && !corrected) {
          corrected = true;
          correction = JSON.stringify(error.issues);
        } else if (!(error instanceof ProviderError && error.retryable)) break;
        if (attempt < 2)
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              1000 * 2 ** (attempt - 1) + Math.random() * 250,
            ),
          );
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
