import { after } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { startSlideJob, runSlideJob } from "@/server/slide-jobs";
import { generateSlidesSchema } from "@/features/slides/schema";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id } = await context.params;
    const input = await parseBody(request, generateSlidesSchema);
    const job = await startSlideJob(actor, id, input);
    after(() => runSlideJob(job.id));
    return Response.json(job, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
}
