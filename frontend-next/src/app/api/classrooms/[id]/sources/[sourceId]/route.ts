import { requireActor } from "@/server/session";
import { ownedClassroom } from "@/server/curriculum-access";
import { getDatabase } from "@/db/client";
import { sourceStorage } from "@/server/storage";
import { AppError, handleError } from "@/server/errors";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { id, sourceId } = await context.params;
    await ownedClassroom(actor, id, false);
    const source = await getDatabase().sourceDocument.findFirst({
      where: {
        id: sourceId,
        classroomId: id,
        classroom: { teacherId: actor.id },
      },
    });
    if (!source) throw new AppError(404, m.sourceMissing);
    return new Response(
      new Uint8Array(await sourceStorage.read(source.storageKey)),
      {
        headers: {
          "Content-Type": source.mimeType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(source.filename)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return handleError(error);
  }
}
