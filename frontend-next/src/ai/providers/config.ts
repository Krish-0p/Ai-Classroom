import "server-only";
import { ProviderError, type ProviderName } from "./provider";
const defaults = {
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
};
export function groqTextModel(task: "primary" | "fast") {
  return (
    (task === "fast"
      ? process.env.GROQ_FAST_MODEL
      : process.env.GROQ_REASONING_MODEL) || "openai/gpt-oss-20b"
  );
}
export function providerBaseURL(provider: ProviderName, officialOnly = false) {
  try {
    const url = new URL(
      (officialOnly
        ? undefined
        : process.env[
            provider === "gemini" ? "GEMINI_API_BASE_URL" : "GROQ_API_BASE_URL"
          ]) || defaults[provider],
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ProviderError();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new ProviderError();
  }
}
