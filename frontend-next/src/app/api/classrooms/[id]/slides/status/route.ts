import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
import { checkOrigin, parseBody } from "@/server/http";
import { setSlideStatus } from "@/server/slides";
import { slideStatusSchema } from "@/features/slides/schema";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireActor(request);
    const { id } = await context.params;
    const input = await parseBody(request, slideStatusSchema);
    return Response.json(
      await setSlideStatus(actor, id, input.version, input.action),
    );
  } catch (error) {
    return handleError(error);
  }
}
