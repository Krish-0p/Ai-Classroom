import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
import { reportTutorSchema } from "@/features/tutor/schema";
import { reportTutor } from "@/server/tutor";
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    const actor = await requireActor(request);
    const input = await parseBody(request, reportTutorSchema);
    return Response.json(await reportTutor(actor, id, input.messageId));
  } catch (error) {
    return handleError(error);
  }
}
