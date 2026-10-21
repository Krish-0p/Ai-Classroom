import { z } from "zod";
import { aiMessages } from "@/lib/ai-messages";
export type ProviderName = "gemini" | "groq";
export type GenerateTextInput = {
  system: string;
  prompt: string;
  jsonSchema?: Record<string, unknown>;
};
export type GenerateTextResult = { text: string; tokens?: number };
export type GenerateStructuredInput<T> = GenerateTextInput & {
  schema: z.ZodType<T>;
};
export interface AIProvider {
  readonly name: ProviderName;
  readonly model: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
}
export class ProviderError extends Error {
  constructor(
    public readonly retryable = false,
    public readonly reason: keyof typeof aiMessages = "unknown",
    public readonly httpStatus?: number,
    public readonly retryAfterMs?: number,
    public readonly providerCode?: string,
  ) {
    super(
      aiMessages[reason] +
        (retryAfterMs !== undefined
          ? ` Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`
          : ""),
    );
    this.name = "ProviderError";
  }
}
export class StructuredOutputError extends Error {
  constructor(
    public readonly issues: {
      path: string;
      code: string;
      message: string;
    }[] = [],
  ) {
    super("AI output did not match the requested schema");
  }
}
export function parseStructured<T>(text: string, schema: z.ZodType<T>): T {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new StructuredOutputError([
      {
        path: "$",
        code: "invalid_json",
        message: "Return a complete JSON object without Markdown fences.",
      },
    ]);
  }
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new StructuredOutputError(
    result.error.issues.slice(0, 8).map((issue) => ({
      path: issue.path.join(".") || "$",
      code: issue.code,
      message: issue.message.slice(0, 300),
    })),
  );
}
