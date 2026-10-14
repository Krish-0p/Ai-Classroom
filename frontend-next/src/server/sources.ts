import "server-only";
import { createHash } from "node:crypto";
import type { Actor } from "@/features/auth/schema";
import { getDatabase } from "@/db/client";
import { ownedClassroom, lockOwnedClassroom } from "@/server/curriculum-access";
import { sourceStorage } from "@/server/storage";
import {
  extractSource,
  normalizeText,
  MAX_SOURCE_BYTES,
  type ExtractedSource,
} from "@/server/source-extraction";
import { AppError } from "@/server/errors";
import { curriculumMessages as m } from "@/lib/curriculum-messages";

export async function storeSource(
  actor: Actor,
  classroomId: string,
  filename: string,
  data: Buffer,
  pasted = false,
) {
  await ownedClassroom(actor, classroomId);
  filename = filename.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 160);
  const extracted: ExtractedSource = pasted
    ? {
        mimeType: "text/plain",
        text: normalizeText(data.toString("utf8")),
        sections: [
          { label: "Pasted text", text: normalizeText(data.toString("utf8")) },
        ],
      }
    : await extractSource(filename, data);
  const contentHash = createHash("sha256")
    .update(extracted.mimeType)
    .update(data)
    .digest("hex");
  const storageKey = await sourceStorage.put(data);
  let retained = false;
  try {
    const stored = await getDatabase().$transaction(async (transaction) => {
      await lockOwnedClassroom(transaction, actor, classroomId);
      const existing = await transaction.sourceDocument.findUnique({
        where: { classroomId_contentHash: { classroomId, contentHash } },
        select: { id: true },
      });
      if (existing) return { ...existing, created: false };
      const count = await transaction.sourceDocument.count({
        where: { classroomId },
      });
      if (count >= 30)
        throw new AppError(413, "Limit each classroom to 30 source documents.");
      const source = await transaction.sourceDocument.create({
        data: {
          classroomId,
          uploadedBy: actor.id,
          filename,
          storageKey,
          contentHash,
          mimeType: extracted.mimeType,
          extractedText: extracted.text,
          metadata: { bytes: data.length, sections: extracted.sections },
        },
        select: { id: true },
      });
      return { ...source, created: true };
    });
    retained = stored.created;
    return { id: stored.id };
  } finally {
    if (!retained) await sourceStorage.remove(storageKey);
  }
}
export async function uploadedFile(
  request: Request,
): Promise<{ filename: string; data: Buffer }> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new AppError(415, m.invalidSource);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, m.invalidSource);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.length;
    if (bytes > MAX_SOURCE_BYTES + 65_536) {
      await reader.cancel();
      throw new AppError(413, m.tooLarge);
    }
    chunks.push(chunk.value);
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new AppError(400, m.invalidSource);
  }
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    [...form.keys()].length !== 1 ||
    !file.name ||
    !file.size ||
    file.size > MAX_SOURCE_BYTES
  )
    throw new AppError(413, m.tooLarge);
  return { filename: file.name, data: Buffer.from(await file.arrayBuffer()) };
}
