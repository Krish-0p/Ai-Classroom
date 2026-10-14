import "server-only";
import { z } from "zod";
import { providerRequest } from "./http";
import { providerBaseURL } from "./config";
import {
  parseStructured,
  ProviderError,
  type AIProvider,
  type GenerateTextInput,
  type GenerateStructuredInput,
} from "./provider";
const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })),
        }),
      }),
    )
    .min(1),
  usageMetadata: z.object({ totalTokenCount: z.number() }).optional(),
});
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  constructor(
    private key: string,
    readonly model: string,
  ) {}
  async generateText(input: GenerateTextInput) {
    const raw = await providerRequest(
      `${providerBaseURL("gemini")}/models/${encodeURIComponent(this.model)}:generateContent`,
      { "x-goog-api-key": this.key },
      {
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 16_384,
          ...(input.jsonSchema
            ? {
                responseMimeType: "application/json",
                responseJsonSchema: input.jsonSchema,
              }
            : {}),
        },
      },
    );
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError();
    return {
      text: parsed.data.candidates[0].content.parts
        .map((part) => part.text ?? "")
        .join(""),
      tokens: parsed.data.usageMetadata?.totalTokenCount,
    };
  }
  async generateStructured<T>(input: GenerateStructuredInput<T>) {
    return parseStructured((await this.generateText(input)).text, input.schema);
  }
}
