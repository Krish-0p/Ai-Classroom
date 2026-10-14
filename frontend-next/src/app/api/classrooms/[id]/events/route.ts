import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
import {
  lessonEventSchema,
  recordLessonActivity,
} from "@/server/learning-events";
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    const actor = await requireActor(request);
    const input = await parseBody(request, lessonEventSchema);
    return Response.json(await recordLessonActivity(actor, id, input));
  } catch (error) {
    return handleError(error);
  }
}
