import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { revealHint } from "@/server/attempts";
import { hintSchema } from "@/features/assessments/schema";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; attemptId: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, attemptId } = await context.params;
    const input = await parseBody(request, hintSchema);
    return NextResponse.json(
      await revealHint(actor, id, attemptId, input.questionId),
    );
  } catch (error) {
    return handleError(error);
  }
}
