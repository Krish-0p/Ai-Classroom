import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { reviewAttempt } from "@/server/attempts";
import { reviewSchema } from "@/features/assessments/schema";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; attemptId: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, attemptId } = await context.params;
    const input = await parseBody(request, reviewSchema);
    return NextResponse.json(await reviewAttempt(actor, id, attemptId, input));
  } catch (error) {
    return handleError(error);
  }
}
