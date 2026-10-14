import "server-only";
import { ProviderError } from "./provider";

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
      await response.body?.cancel();
      throw new ProviderError(
        response.status === 429 || response.status >= 500,
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
      );
    }
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
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof SyntaxError) throw new ProviderError(false, "unknown");
    const timeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ProviderError(true, timeout ? "timeout" : "network");
  }
}
