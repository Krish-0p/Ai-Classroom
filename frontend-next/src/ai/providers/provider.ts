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
  ) {
    super(aiMessages[reason]);
    this.name = "ProviderError";
  }
}
export class StructuredOutputError extends Error {
  constructor() {
    super("AI output did not match the curriculum schema");
  }
}
export function parseStructured<T>(text: string, schema: z.ZodType<T>): T {
  try {
    const value: unknown = JSON.parse(text);
    const result = schema.safeParse(value);
    if (result.success) return result.data;
  } catch {
    /* Only schema-validated JSON may enter the application. */
  }
  throw new StructuredOutputError();
}
