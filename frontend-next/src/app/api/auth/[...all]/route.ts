import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import { registrationSchema } from "@/features/auth/schema";
import { parseBody } from "@/server/http";
import { handleError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    return await toNextJsHandler(getAuth()).GET(request);
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request) {
  try {
    let authRequest = request;
    if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
      const input = await parseBody(request, registrationSchema);
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      authRequest = new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
    }
    return await toNextJsHandler(getAuth()).POST(authRequest);
  } catch (error) {
    return handleError(error);
  }
}
