import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
import { after } from "next/server";
import { tutorQuestionSchema } from "@/features/tutor/schema";
import { readTutor, startTutor, runTutor, clearTutor } from "@/server/tutor";
export const maxDuration = 180;
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return Response.json(await readTutor(await requireActor(request), id));
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    const actor = await requireActor(request);
    const input = await parseBody(request, tutorQuestionSchema);
    const result = await startTutor(actor, id, input);
    after(() => runTutor(result.id));
    return Response.json(result, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    return Response.json(await clearTutor(await requireActor(request), id));
  } catch (error) {
    return handleError(error);
  }
}
