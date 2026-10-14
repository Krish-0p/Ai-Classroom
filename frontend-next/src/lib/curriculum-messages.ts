export const curriculumMessages = {
  title: "Curriculum",
  teacherHelp:
    "Import sources, review the draft, then approve it for students.",
  studentHelp: "Explore your teacher-approved units and concept prerequisites.",
  sources: "Course sources",
  linkedSources: "Sources linked to this curriculum",
  linkedSourceHelp:
    "These selected sources are approved alongside the curriculum and can ground lesson generation.",
  sourceHelp:
    "Upload PDF, DOCX, PPTX or TXT (up to 8 MB). Legacy PPT and scanned PDFs need conversion to text first.",
  sourceName: "Source name",
  sourceText: "Paste syllabus or notes",
  paste: "Save pasted source",
  upload: "Upload source",
  file: "Source file",
  noSources: "No sources yet",
  noSourcesHelp:
    "Paste course material or upload a document. You can also build a curriculum manually below.",
  generate: "Extract curriculum with AI",
  generateHelp:
    "Selected source text is sent to the configured AI provider. AI drafts stay private until you approve them.",
  draft: "Teacher draft",
  draftHelp:
    "Edit titles, outcomes and prerequisites. Save the draft before approving. Students continue seeing the last approved version.",
  courseTitle: "Course title",
  outcomes: "Learning outcomes (one per line)",
  unit: "Unit",
  concept: "Concept",
  description: "Description",
  prerequisites: "Prerequisites",
  addUnit: "Add unit",
  addConcept: "Add concept",
  remove: "Remove",
  up: "Move up",
  down: "Move down",
  save: "Save draft",
  approve: "Approve saved draft for students",
  saved: "Draft saved. Review it, then approve when ready.",
  approved: "Approved curriculum",
  approvalDone: "Curriculum approved. Students can now see this version.",
  empty: "Curriculum not published yet",
  emptyHelp:
    "Your teacher is preparing the course curriculum. Check back soon.",
  graph: "Concept knowledge graph",
  graphHelp:
    "Arrows run from each prerequisite to the concept that builds on it. The list below provides the same relationships in text.",
  noPrerequisites: "No prerequisites",
  selection: "Include in extraction",
  queued: "Extraction queued",
  generating: "AI is extracting the curriculum…",
  complete: "AI draft ready. Review and save edits before approval.",
  failed: "Extraction failed",
  pendingHelp: "You can leave this page and return while extraction runs.",
  conflict: "The draft changed. Reload the page before saving or approving.",
  archived: "This classroom is archived. Curriculum changes are disabled.",
  invalidSource:
    "Unsupported or invalid source. Use PDF, DOCX, PPTX or UTF-8 TXT.",
  tooLarge:
    "Source exceeds the size or text limit. Split it into smaller documents.",
  noText:
    "No readable text found. Convert scanned documents with OCR before uploading.",
  aiUnavailable:
    "AI extraction is unavailable. Check provider configuration or create the draft manually.",
  aiFailed:
    "AI extraction could not produce a valid curriculum. Retry or build the draft manually.",
  activeJob: "An extraction is already running. Wait for it to finish.",
  rateLimit: "Too many extraction requests. Wait a minute before retrying.",
  timeout: "Extraction timed out. Retry or create the draft manually.",
  sourceMissing: "Selected sources are unavailable in this classroom.",
  back: "Back to classroom",
  loading: "Loading curriculum…",
} as const;
