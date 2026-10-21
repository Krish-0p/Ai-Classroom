import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db/client";
import { MAX_SOURCE_BYTES } from "@/lib/source-limits";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
import { AppError } from "./errors";
import type { SourceStorage } from "./storage";

function validKey(key: string) {
  if (!/^db:[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return key;
}

// Suitable for small classroom documents; object storage can implement the same contract later.
export class DatabaseSourceStorage implements SourceStorage {
  async put(data: Uint8Array) {
    if (!data.byteLength || data.byteLength > MAX_SOURCE_BYTES)
      throw new AppError(413, m.tooLarge);
    const key = `db:${randomUUID()}`;
    await getDatabase().storedSourceFile.create({
      data: { key, data: new Uint8Array(data) },
    });
    return key;
  }
  async read(key: string) {
    const row = await getDatabase().storedSourceFile.findUnique({
      where: { key: validKey(key) },
      select: { data: true },
    });
    if (!row) throw new AppError(404, m.sourceMissing);
    return Buffer.from(row.data);
  }
  async remove(key: string) {
    await getDatabase().storedSourceFile.deleteMany({
      where: { key: validKey(key) },
    });
  }
}
