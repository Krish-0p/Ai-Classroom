import "server-only";
import { ProviderError, type ProviderName } from "./provider";
const defaults = {
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
};
export function providerBaseURL(provider: ProviderName) {
  try {
    const url = new URL(
      process.env[
        provider === "gemini" ? "GEMINI_API_BASE_URL" : "GROQ_API_BASE_URL"
      ] || defaults[provider],
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
