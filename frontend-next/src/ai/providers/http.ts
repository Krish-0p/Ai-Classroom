import "server-only";
import { ProviderError } from "./provider";

async function readProviderJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 1_000_000) {
      await reader.cancel();
      throw new ProviderError();
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

const safeErrorCodes = new Set([
  "rate_limit_exceeded",
  "json_validate_failed",
  "model_not_found",
  "invalid_api_key",
  "invalid_request_error",
  "context_length_exceeded",
]);

export async function providerRequest(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      let providerCode: string | undefined;
      try {
        const body = await readProviderJson(response);
        if (body && typeof body === "object" && "error" in body) {
          const error = body.error;
          if (error && typeof error === "object") {
            const candidates = [
              "code" in error ? error.code : undefined,
              "type" in error ? error.type : undefined,
            ];
            providerCode = candidates.find(
              (code): code is string =>
                typeof code === "string" && safeErrorCodes.has(code),
            );
          }
        }
      } catch {
        // Error bodies may be empty or non-JSON. Preserve the HTTP failure.
      }
      const retryAfter = response.headers.get("retry-after");
      const retrySeconds = retryAfter === null ? NaN : Number(retryAfter);
      const retryDelay = Number.isFinite(retrySeconds)
        ? retrySeconds * 1000
        : retryAfter === null
          ? NaN
          : Date.parse(retryAfter) - Date.now();
      const retryAfterMs =
        response.status === 429 && Number.isFinite(retryDelay)
          ? Math.min(86_400_000, Math.max(0, retryDelay))
          : undefined;
      throw new ProviderError(
        response.status >= 500,
        response.status === 401 || response.status === 403
          ? "credentials"
          : response.status === 404
            ? "model"
            : response.status === 429
              ? "quota"
              : response.status >= 500
                ? "unavailable"
                : "request",
        response.status,
        retryAfterMs,
        providerCode,
      );
    }
    return await readProviderJson(response);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof SyntaxError) throw new ProviderError(false, "unknown");
    const timeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ProviderError(true, timeout ? "timeout" : "network");
  }
}
