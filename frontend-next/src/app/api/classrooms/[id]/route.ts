import { classroomSchema } from "@/features/classrooms/schema";
import {
  readClassroom,
  updateClassroom,
  deleteClassroom,
} from "@/server/classrooms";
import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return Response.json(
      await readClassroom(
        await requireActor(request),
        (await context.params).id,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    return Response.json(
      await updateClassroom(
        actor,
        (await context.params).id,
        await parseBody(request, classroomSchema),
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    await deleteClassroom(
      await requireActor(request),
      (await context.params).id,
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
