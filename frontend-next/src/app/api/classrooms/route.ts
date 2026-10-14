import { classroomSchema } from "@/features/classrooms/schema";
import { createClassroom, listClassrooms } from "@/server/classrooms";
import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    return Response.json(await listClassrooms(await requireActor(request)));
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    return Response.json(
      await createClassroom(actor, await parseBody(request, classroomSchema)),
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
