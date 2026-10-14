import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { readAttempt, saveOrSubmitAttempt } from "@/server/attempts";
import { submitSchema } from "@/features/assessments/schema";
type Context = { params: Promise<{ id: string; attemptId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id, attemptId } = await context.params;
    return NextResponse.json(
      await readAttempt(await requireActor(request), id, attemptId),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, attemptId } = await context.params;
    const input = await parseBody(request, submitSchema, 512_000);
    return NextResponse.json(
      await saveOrSubmitAttempt(actor, id, attemptId, input.responses, false),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, attemptId } = await context.params;
    const input = await parseBody(request, submitSchema, 512_000);
    return NextResponse.json(
      await saveOrSubmitAttempt(actor, id, attemptId, input.responses, true),
    );
  } catch (error) {
    return handleError(error);
  }
}
