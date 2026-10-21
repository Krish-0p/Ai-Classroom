export const aiMessages = {
  unknown:
    "The AI provider could not complete the request. Try again later or continue manually.",
  configuration:
    "The AI provider settings are invalid. Check the server provider, output mode, reasoning effort and token limit settings.",
  outputLimit:
    "The AI response reached its output limit. Use fewer source documents or request fewer items, or increase GROQ_MAX_COMPLETION_TOKENS on the server.",
  network:
    "The server cannot reach the AI provider. Check outbound network permissions or your connection, then retry.",
  timeout:
    "The AI provider timed out. Try fewer source documents or retry later.",
  credentials:
    "The AI provider rejected access. Check your Groq key in AI settings and its permissions.",
  model:
    "The configured AI model or endpoint is unavailable. Check the provider model settings.",
  quota:
    "The AI provider's rate limit or quota was reached. Wait before retrying or check your provider allowance.",
  request:
    "The AI provider rejected the request. Check model compatibility and source size, or use fewer documents.",
  unavailable:
    "The AI provider is temporarily unavailable. Retry later or continue manually.",
} as const;
