export const tutorMessages = {
  title: "Classroom tutor",
  description:
    "Ask about approved classroom sources. Answers are AI-generated, not teacher-approved, and may be incorrect. Check the cited excerpts.",
  question: "Your question",
  ask: "Ask tutor",
  pending: "Finding sources and preparing an answer…",
  retry: "Retry",
  empty: "No questions yet",
  emptyHelp: "Ask a question after your teacher indexes approved sources.",
  indexTitle: "Tutor sources",
  indexHelp:
    "Index each approved source once. This explicitly calls Gemini embeddings; unchanged indexed content is reused. Removing a source from the approved curriculum immediately removes it from retrieval.",
  index: "Index source",
  ready: "Ready",
  notIndexed: "Not indexed",
  queued: "Queued",
  generating: "Generating",
  complete: "Complete",
  failed: "Failed",
  back: "Back to classroom",
  lesson: "Lesson context (optional)",
  noLesson: "Whole classroom",
  source: "Source excerpts",
  report: "Report incorrect answer",
  reported: "Reported for review",
  reportHelp:
    "Reporting shares this question, answer and citations with the classroom teacher.",
  reports: "Reported tutor answers",
  noReports: "No reported answers.",
  unavailable:
    "The tutor is unavailable. Ask your teacher to check embedding and text provider configuration.",
  insufficient:
    "I could not find enough relevant evidence in the approved classroom sources. Ask your teacher for supporting material or try a more specific question.",
  stale:
    "The approved material changed. Please ask again using the current sources.",
  rateLimit: "Too many requests. Wait a minute before trying again.",
  busy: "A tutor answer is already being prepared. Please wait.",
  error:
    "The tutor could not finish. Your classroom remains available. Try again later.",
  archived: "This classroom is archived and read-only.",
  noSources: "Approve linked curriculum sources before indexing.",
  indexFailed:
    "Source indexing failed. Check configuration and retry; completed embedding batches are cached.",
  indexBusy: "A classroom generation job is already running.",
  timeout: "This request expired. Please retry.",
  cached: "Unchanged source already indexed.",
  citationRemoved:
    "This answer's source approval changed; its content is no longer available.",
  notFound: "This classroom resource is unavailable.",
  eventError:
    "Learning activity could not be saved. Your lesson remains usable.",
  readOnly: "Read-only classroom",
  indexing: "Indexing…",
  openLesson: "Open lesson",
  deleteHistory: "Clear my tutor history",
  deleteConfirm:
    "Clear your tutor questions and answers? This cannot be undone.",
  cleared: "History cleared.",
} as const;
