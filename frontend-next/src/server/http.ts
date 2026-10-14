import { z } from "zod";
import { AppError } from "@/server/errors";
import { messages } from "@/lib/messages";

export function checkOrigin(request: Request) {
  const configuredURL = process.env.BETTER_AUTH_URL;
  if (
    !configuredURL ||
    request.headers.get("origin") !== new URL(configuredURL).origin
  )
    throw new AppError(403, messages.origin);
}
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 16_384,
): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, messages.invalidJson);
  // Bound actual body bytes, not just the client-controlled Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, messages.invalidJson);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new AppError(413, messages.invalid);
    }
    chunks.push(value);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, messages.invalidJson);
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new AppError(
      400,
      result.error.issues[0]?.message ?? messages.invalid,
    );
  return result.data;
}
