export const teacherAiMessages = {
  title: "AI settings",
  eyebrow: "YOUR TEACHING ACCOUNT",
  description:
    "Bring your own Groq API key to generate curriculum, lessons, assessments, and slides across your classrooms.",
  provider: "Groq API key",
  help: "Your key is encrypted on the server and is never shown again. Students and other teachers cannot access it.",
  consent:
    "Generating content sends the selected course material to Groq and uses your Groq allowance. Manual editing and published student content do not need an API key.",
  keyLabel: "API key",
  placeholder: "Paste your Groq API key",
  fieldHelp:
    "Paste only the key, without quotes or a Bearer prefix. Saving does not contact Groq or verify its quota.",
  invalid:
    "Enter a valid Groq API key without spaces, quotes, or a Bearer prefix.",
  save: "Save key",
  replace: "Replace key",
  remove: "Remove saved key",
  confirmRemove: "Confirm removal",
  removeWarning:
    "Remove your saved Groq key? New generation requests will stop until you add a key again. An in-flight request may still finish.",
  saved:
    "Key saved securely. It has not been verified with Groq; you can now start a generation request.",
  removed: "Key removed. Your existing classroom content is unchanged.",
  configured: "Key saved · not verified",
  notConfigured: "No key saved",
  updated: "Last saved",
  missing:
    "Add your Groq API key in AI settings before generating content. You can still work manually.",
  setupTitle: "Set up your AI key",
  setupHelp:
    "Add your own Groq key once to use AI generation in all your classrooms.",
  open: "Open AI settings",
  getKey: "Create a Groq API key",
  storageUnavailable:
    "Secure key storage is not configured. The app administrator must set AI_CREDENTIAL_ENCRYPTION_KEY to a 64-character hexadecimal secret on the server.",
  unlockFailed:
    "Your saved key could not be unlocked. Re-enter it in AI settings, or ask the administrator to check the encryption configuration.",
  securityTitle: "Private to your account",
  securityHelp:
    "This setting belongs to your teacher account, not a classroom. No shared server key is used as a fallback. Removing the key does not revoke it at Groq; revoke it in the Groq console if needed.",
} as const;
