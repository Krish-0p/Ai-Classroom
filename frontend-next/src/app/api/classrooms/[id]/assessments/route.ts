import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { listAssessments, createAssessment } from "@/server/assessments";
import { createAssessmentSchema } from "@/features/assessments/schema";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return NextResponse.json(
      await listAssessments(
        await requireActor(request),
        (await context.params).id,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const input = await parseBody(request, createAssessmentSchema);
    return NextResponse.json(
      await createAssessment(actor, (await context.params).id, input.title),
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
