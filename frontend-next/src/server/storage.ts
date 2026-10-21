import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSourceStorage } from "./database-source-storage";

export interface SourceStorage {
  put(data: Uint8Array): Promise<string>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export class LocalSourceStorage implements SourceStorage {
  // Storage is runtime data; private source files must not enter build tracing.
  private root = resolve(
    /* turbopackIgnore: true */ process.env.SOURCE_STORAGE_DIR ||
      ".data/sources",
  );
  private path(key: string) {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid storage key");
    return join(this.root, key);
  }
  async put(data: Uint8Array) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = randomUUID();
    await writeFile(this.path(key), data, { flag: "wx", mode: 0o600 });
    return key;
  }
  read(key: string) {
    return readFile(this.path(key));
  }
  async remove(key: string) {
    await unlink(this.path(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
const local = new LocalSourceStorage();
const database = new DatabaseSourceStorage();
function uploadStorage(): SourceStorage {
  const provider =
    process.env.SOURCE_STORAGE_PROVIDER ||
    (process.env.VERCEL === "1" ? "database" : "local");
  if (provider === "database") return database;
  if (provider === "local" && process.env.VERCEL !== "1") return local;
  throw new Error(
    "Use SOURCE_STORAGE_PROVIDER=database on Vercel; local storage is only available on a persistent Node server.",
  );
}
export const sourceStorage: SourceStorage = {
  put(data) {
    return uploadStorage().put(data);
  },
  read(key) {
    return key.startsWith("db:") ? database.read(key) : local.read(key);
  },
  remove(key) {
    return key.startsWith("db:") ? database.remove(key) : local.remove(key);
  },
};
