import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { listLessons, createLesson } from "@/server/lessons";
import { createLessonSchema } from "@/features/lessons/schema";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return NextResponse.json(
      await listLessons(await requireActor(request), (await context.params).id),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const input = await parseBody(request, createLessonSchema);
    return NextResponse.json(
      await createLesson(actor, (await context.params).id, input.conceptId),
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
