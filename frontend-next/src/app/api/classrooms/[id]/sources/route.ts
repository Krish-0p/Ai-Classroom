import { NextResponse } from "next/server";
import { requireActor } from "@/server/session";
import { checkOrigin, parseBody } from "@/server/http";
import { handleError } from "@/server/errors";
import { ownedClassroom } from "@/server/curriculum-access";
import { storeSource, uploadedFile } from "@/server/sources";
import { pasteSchema } from "@/features/curriculum/schema";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id } = await context.params;
    await ownedClassroom(actor, id);
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = await parseBody(request, pasteSchema, 512_000);
      return NextResponse.json(
        await storeSource(
          actor,
          id,
          input.filename,
          Buffer.from(input.text),
          true,
        ),
        { status: 201 },
      );
    }
    const file = await uploadedFile(request);
    return NextResponse.json(
      await storeSource(actor, id, file.filename, file.data),
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
