import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { assessmentStatus } from "@/server/assessments";
import { assessmentStatusSchema } from "@/features/assessments/schema";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, assessmentId } = await context.params;
    const input = await parseBody(request, assessmentStatusSchema);
    return NextResponse.json(
      await assessmentStatus(
        actor,
        id,
        assessmentId,
        input.version,
        input.action,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
