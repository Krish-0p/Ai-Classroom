import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";

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
export const sourceStorage: SourceStorage = new LocalSourceStorage();
