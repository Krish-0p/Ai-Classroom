import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";
import { approveCurriculum } from "@/server/curriculum";
import { approveSchema } from "@/features/curriculum/schema";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const input = await parseBody(request, approveSchema);
    return NextResponse.json(
      await approveCurriculum(actor, (await context.params).id, input.version),
    );
  } catch (error) {
    return handleError(error);
  }
}
