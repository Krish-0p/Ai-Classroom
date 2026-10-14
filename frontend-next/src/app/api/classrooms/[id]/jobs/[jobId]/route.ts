import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { readCurriculumJob } from "@/server/curriculum-jobs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  try {
    const { id, jobId } = await context.params;
    return NextResponse.json(
      await readCurriculumJob(await requireActor(request), id, jobId),
    );
  } catch (error) {
    return handleError(error);
  }
}
