import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { after } from "next/server";
import { startLessonJob, runLessonJob } from "@/server/lesson-jobs";
import { generateLessonSchema } from "@/features/lessons/schema";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; lessonId: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, lessonId } = await context.params;
    const input = await parseBody(request, generateLessonSchema);
    const job = await startLessonJob(
      actor,
      id,
      lessonId,
      input.version,
      input.instruction,
    );
    after(() => runLessonJob(job.id));
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
}
