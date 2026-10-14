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
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
  usage: z.object({ total_tokens: z.number() }).optional(),
});
export class GroqProvider implements AIProvider {
  readonly name = "groq";
  constructor(
    private key: string,
    readonly model: string,
  ) {}
  async generateText(input: GenerateTextInput) {
    const raw = await providerRequest(
      `${providerBaseURL("groq")}/chat/completions`,
      { Authorization: `Bearer ${this.key}` },
      {
        model: this.model,
        temperature: 0.2,
        max_completion_tokens: 16_384,
        messages: [
          {
            role: "system",
            content: input.jsonSchema
              ? `${input.system}\nReturn JSON conforming to this output schema: ${JSON.stringify(input.jsonSchema)}`
              : input.system,
          },
          { role: "user", content: input.prompt },
        ],
        ...(input.jsonSchema
          ? { response_format: { type: "json_object" } }
          : {}),
      },
    );
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError();
    return {
      text: parsed.data.choices[0].message.content,
      tokens: parsed.data.usage?.total_tokens,
    };
  }
  async generateStructured<T>(input: GenerateStructuredInput<T>) {
    return parseStructured((await this.generateText(input)).text, input.schema);
  }
}
