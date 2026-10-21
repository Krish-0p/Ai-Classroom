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
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z.object({ total_tokens: z.number() }).optional(),
});
export class GroqProvider implements AIProvider {
  readonly name = "groq";
  constructor(
    private key: string,
    readonly model: string,
    private readonly officialEndpointOnly = false,
  ) {}
  async generateText(input: GenerateTextInput) {
    const settings = z
      .object({
        maxTokens: z.coerce.number().int().min(1).max(65_536),
        reasoningEffort: z.enum(["low", "medium", "high"]),
        outputMode: z.enum(["json_schema", "json_object"]),
      })
      .safeParse({
        maxTokens: process.env.GROQ_MAX_COMPLETION_TOKENS || "4096",
        reasoningEffort: process.env.GROQ_REASONING_EFFORT || "low",
        outputMode: process.env.GROQ_STRUCTURED_OUTPUT_MODE || "json_schema",
      });
    if (!settings.success) throw new ProviderError(false, "configuration");
    const { maxTokens, reasoningEffort, outputMode } = settings.data;
    const raw = await providerRequest(
      `${providerBaseURL("groq", this.officialEndpointOnly)}/chat/completions`,
      { Authorization: `Bearer ${this.key}` },
      {
        model: this.model,
        temperature: 0.2,
        max_completion_tokens: maxTokens,
        ...(this.model.startsWith("openai/gpt-oss-")
          ? { reasoning_effort: reasoningEffort }
          : {}),
        messages: [
          {
            role: "system",
            content:
              input.jsonSchema && outputMode === "json_object"
                ? `${input.system}\nReturn JSON conforming to this output schema: ${JSON.stringify(input.jsonSchema)}`
                : input.system,
          },
          { role: "user", content: input.prompt },
        ],
        ...(input.jsonSchema
          ? {
              response_format:
                outputMode === "json_schema"
                  ? {
                      type: "json_schema",
                      json_schema: {
                        name: "educational_content",
                        strict: true,
                        schema: input.jsonSchema,
                      },
                    }
                  : { type: "json_object" },
            }
          : {}),
      },
    );
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError();
    const choice = parsed.data.choices[0];
    if (choice.finish_reason === "length")
      throw new ProviderError(false, "outputLimit");
    if (!choice.message.content) throw new ProviderError();
    return {
      text: choice.message.content,
      tokens: parsed.data.usage?.total_tokens,
    };
  }
  async generateStructured<T>(input: GenerateStructuredInput<T>) {
    return parseStructured((await this.generateText(input)).text, input.schema);
  }
}
