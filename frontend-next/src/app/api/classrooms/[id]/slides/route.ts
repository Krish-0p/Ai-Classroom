import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { readSlides, saveSlides } from "@/server/slides";
import { saveSlidesSchema } from "@/features/slides/schema";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return Response.json(await readSlides(await requireActor(request), id));
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id } = await context.params;
    const input = await parseBody(request, saveSlidesSchema, 65_536);
    return Response.json(
      await saveSlides(actor, id, input.version, input.deck),
    );
  } catch (error) {
    return handleError(error);
  }
}
