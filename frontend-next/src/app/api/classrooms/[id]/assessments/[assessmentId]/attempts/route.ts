import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin } from "@/server/http";
import { startAttempt, assessmentAttempts } from "@/server/attempts";
type Context = { params: Promise<{ id: string; assessmentId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id, assessmentId } = await context.params;
    return NextResponse.json(
      await startAttempt(await requireActor(request), id, assessmentId),
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function GET(request: Request, context: Context) {
  try {
    const { id, assessmentId } = await context.params;
    return NextResponse.json(
      await assessmentAttempts(await requireActor(request), id, assessmentId),
    );
  } catch (error) {
    return handleError(error);
  }
}
