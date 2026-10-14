import { requireActor } from "@/server/session";
import { handleError } from "@/server/errors";
type Context = { params: Promise<{ id: string }> };
import { readAnalytics } from "@/server/analytics";
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return Response.json(await readAnalytics(await requireActor(request), id));
  } catch (error) {
    return handleError(error);
  }
}
