import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";
import { teacherAiKeySchema } from "@/features/ai-settings/schema";
import {
  readTeacherAiStatus,
  saveTeacherAiKey,
  removeTeacherAiKey,
} from "@/server/teacher-ai-settings";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    return Response.json(
      await readTeacherAiStatus(await requireActor(request)),
      { headers: privateHeaders },
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const input = await parseBody(request, teacherAiKeySchema, 1024);
    return Response.json(await saveTeacherAiKey(actor, input), {
      headers: privateHeaders,
    });
  } catch (error) {
    return handleError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    return Response.json(
      await removeTeacherAiKey(await requireActor(request)),
      { headers: privateHeaders },
    );
  } catch (error) {
    return handleError(error);
  }
}
