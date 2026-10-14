import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { readLesson, saveLesson, deleteLesson } from "@/server/lessons";
import { saveLessonSchema } from "@/features/lessons/schema";
type Context = { params: Promise<{ id: string; lessonId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id, lessonId } = await context.params;
    return NextResponse.json(
      await readLesson(await requireActor(request), id, lessonId),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, lessonId } = await context.params;
    const input = await parseBody(request, saveLessonSchema, 512_000);
    return NextResponse.json(
      await saveLesson(actor, id, lessonId, input.version, input.lesson),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, lessonId } = await context.params;
    await deleteLesson(actor, id, lessonId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
