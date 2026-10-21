import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./errors";
import { teacherAiMessages as m } from "@/lib/teacher-ai-messages";

export function aiCredentialStorageReady() {
  return /^[a-fA-F0-9]{64}$/.test(
    process.env.AI_CREDENTIAL_ENCRYPTION_KEY ?? "",
  );
}
function encryptionKey() {
  if (!aiCredentialStorageReady())
    throw new AppError(503, m.storageUnavailable);
  return Buffer.from(process.env.AI_CREDENTIAL_ENCRYPTION_KEY!, "hex");
}
function context(teacherId: string) {
  return Buffer.from(`openlearn:teacher:${teacherId}:groq:v1`, "utf8");
}
export function encryptTeacherKey(teacherId: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv, {
    authTagLength: 16,
  });
  cipher.setAAD(context(teacherId));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptTeacherKey(teacherId: string, value: string) {
  const key = encryptionKey();
  try {
    const parts = value.split(".");
    if (parts.length !== 4 || parts[0] !== "v1")
      throw new Error("Invalid credential envelope");
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const encrypted = Buffer.from(parts[3], "base64url");
    if (
      iv.length !== 12 ||
      tag.length !== 16 ||
      !encrypted.length ||
      encrypted.length > 256
    )
      throw new Error("Invalid credential envelope");
    const decipher = createDecipheriv("aes-256-gcm", key, iv, {
      authTagLength: 16,
    });
    decipher.setAAD(context(teacherId));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Never include ciphertext, plaintext, or the underlying crypto error.
    throw new AppError(503, m.unlockFailed);
  }
}
