import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { after } from "next/server";
import { generateAssessmentSchema } from "@/features/assessments/schema";
import { startAssessmentJob, runAssessmentJob } from "@/server/assessment-jobs";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, assessmentId } = await context.params;
    const input = await parseBody(request, generateAssessmentSchema);
    const job = await startAssessmentJob(
      actor,
      id,
      assessmentId,
      input.version,
      input.options,
    );
    after(() => runAssessmentJob(job.id));
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
}
