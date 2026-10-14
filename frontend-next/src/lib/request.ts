import { messages } from "@/lib/messages";

export async function sendRequest<T>(
  url: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(messages.networkError);
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : payload &&
            typeof payload === "object" &&
            "message" in payload &&
            typeof payload.message === "string"
          ? payload.message
          : messages.serverError;
    throw new Error(message);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}
