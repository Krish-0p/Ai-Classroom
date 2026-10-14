import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { changeLessonStatus } from "@/server/lessons";
import { lessonStatusSchema } from "@/features/lessons/schema";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; lessonId: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id, lessonId } = await context.params;
    const input = await parseBody(request, lessonStatusSchema);
    return NextResponse.json(
      await changeLessonStatus(
        actor,
        id,
        lessonId,
        input.version,
        input.action,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
