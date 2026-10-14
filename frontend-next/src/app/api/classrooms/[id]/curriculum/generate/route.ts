import { after, NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";
import { generateSchema } from "@/features/curriculum/schema";
import { startCurriculumJob, runCurriculumJob } from "@/server/curriculum-jobs";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const input = await parseBody(request, generateSchema);
    const job = await startCurriculumJob(
      actor,
      (await context.params).id,
      input.sourceIds,
    );
    after(() => runCurriculumJob(job.id));
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
}
