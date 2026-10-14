import { joinSchema } from "@/features/classrooms/schema";
import { joinClassroom } from "@/server/classrooms";
import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { code } = await parseBody(request, joinSchema);
    return Response.json(await joinClassroom(actor, code));
  } catch (error) {
    return handleError(error);
  }
}
