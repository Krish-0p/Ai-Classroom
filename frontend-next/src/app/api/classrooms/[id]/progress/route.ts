import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { readProgress } from "@/server/mastery";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return NextResponse.json(
      await readProgress(
        await requireActor(request),
        (await context.params).id,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
