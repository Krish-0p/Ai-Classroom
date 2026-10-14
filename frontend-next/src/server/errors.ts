import { messages } from "@/lib/messages";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function handleError(error: unknown): Response {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  // Log only the error class, never database URLs, request content or credentials.
  console.error("foundation_request_failed", {
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return Response.json({ error: messages.serverError }, { status: 503 });
}
