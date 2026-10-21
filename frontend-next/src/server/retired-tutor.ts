import "server-only";
import { requireActor } from "./session";
import { readClassroom } from "./classrooms";
import { checkOrigin } from "./http";
import { handleError } from "./errors";
import { slideMessages as m } from "@/lib/slide-messages";
export async function retiredTutor(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (request.method !== "GET") checkOrigin(request);
    const actor = await requireActor(request);
    const { id } = await context.params;
    await readClassroom(actor, id);
    return Response.json({ error: m.retired }, { status: 410 });
  } catch (error) {
    return handleError(error);
  }
}
