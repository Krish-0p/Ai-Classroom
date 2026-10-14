import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";
import { readCurriculum, saveCurriculum } from "@/server/curriculum";
import { saveDraftSchema } from "@/features/curriculum/schema";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return NextResponse.json(
      await readCurriculum(
        await requireActor(request),
        (await context.params).id,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function PUT(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const input = await parseBody(request, saveDraftSchema, 512_000);
    return NextResponse.json(
      await saveCurriculum(
        actor,
        (await context.params).id,
        input.version,
        input.curriculum,
        input.sourceIds,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
