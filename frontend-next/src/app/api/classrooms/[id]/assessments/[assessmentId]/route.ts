import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { readAssessment, saveAssessment } from "@/server/assessments";
import { saveAssessmentSchema } from "@/features/assessments/schema";
type Context = { params: Promise<{ id: string; assessmentId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id, assessmentId } = await context.params;
    return NextResponse.json(
      await readAssessment(await requireActor(request), id, assessmentId),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, assessmentId } = await context.params;
    const input = await parseBody(request, saveAssessmentSchema, 512_000);
    return NextResponse.json(
      await saveAssessment(
        actor,
        id,
        assessmentId,
        input.version,
        input.assessment,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
