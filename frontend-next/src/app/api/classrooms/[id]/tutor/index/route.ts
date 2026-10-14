import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
import { after } from "next/server";
import { indexSourceSchema } from "@/features/tutor/schema";
import { readIndexes, startIndex, runIndex } from "@/server/rag-index";
export const maxDuration = 180;
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return Response.json(await readIndexes(await requireActor(request), id));
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    const actor = await requireActor(request);
    const input = await parseBody(request, indexSourceSchema);
    const result = await startIndex(actor, id, input.sourceId);
    if (result.id) {
      const jobId = result.id;
      after(() => runIndex(jobId));
    }
    return Response.json(result, { status: result.cached ? 200 : 202 });
  } catch (error) {
    return handleError(error);
  }
}
