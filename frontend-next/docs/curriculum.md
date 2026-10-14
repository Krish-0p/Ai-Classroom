# Milestone B — Curriculum

The latest source-link/caching changes await user verification. Select sources under **Sources linked to this curriculum**, save, then approve; publication stores a separate source selection for lesson generation. Repeating extraction with unchanged inputs reuses the current generated draft. Apply the migration described in [Lesson setup](lessons.md#setup) before using the latest changes.

Teachers open **Curriculum** from a classroom. They can import a source, select sources for AI extraction, or build units and concepts manually. **Save draft** persists edits; **Approve saved draft for students** publishes that version. AI never approves or publishes. Students see only the approved course, outcomes, units, concepts and knowledge graph. New drafts leave the last approved version visible.

## Architecture

- `src/features/curriculum`: shared validation, source panel and teacher editor.
- `src/features/knowledge-graph`: accessible SVG graph and equivalent relationship list.
- `src/ai/providers`: Gemini and Groq implementations of `AIProvider` with server-side HTTP requests.
- `src/ai/router`: configurable curriculum task routing, bounded retries, schema correction and fallback.
- `src/ai/prompts`: versioned curriculum prompt; source documents are explicitly untrusted data.
- `src/server`: ingestion, storage interface, transactions, publication and persisted generation jobs.

PostgreSQL stores private source text/citation metadata, editable and approved snapshots, generation status, and normalized `CourseUnit`, `Concept` and `ConceptDependency` rows. IDs remain stable across reapproval when concept keys remain unchanged. Draft versions enforce optimistic concurrency. Approval updates the graph and published snapshot in one transaction. A running extraction cannot replace a draft edited after it started.

## Configuration

Set `GEMINI_API_KEY` and `GEMINI_TEXT_MODEL`, and/or `GROQ_API_KEY` and `GROQ_REASONING_MODEL` in `.env.local`. `AI_PRIMARY_PROVIDER` selects Gemini or Groq; the other configured provider is the fallback. Model defaults are shown in `.env.example` and can be changed without source edits. Missing/invalid provider configuration leaves manual authoring usable. Embedding, fast, TTS and transcription model variables are reserved for later milestones; they are not invoked here.

Gemini uses JSON Schema output. Groq uses JSON object output with the same schema supplied in the domain prompt. Both outputs undergo the same Zod and graph validation. Each provider has at most two attempts (transient retry or schema correction), then the router falls back. Requests time out after 20 seconds. Metadata logs contain provider/model, latency, attempt, token count and schema result; never keys, source text, prompts or personal data.

Extraction returns HTTP 202 with a job ID. Next.js `after()` runs the task; the teacher panel polls a persisted status. Jobs survive page navigation. If the process exits, a pending job expires after three minutes and can be retried. This is a small single-process implementation, not a durable worker queue. Keep the Node server alive and allow route duration of 180 seconds. One extraction per classroom at a time; at most three starts per minute. Sources are deduplicated by classroom/content hash.

## Source storage and limits

Files are stored under `SOURCE_STORAGE_DIR` (default `.data/sources`), using generated UUID names, outside public assets and build tracing. `SourceStorage` allows adding another backend later. Use persistent disk with restrictive permissions in deployment, and back it up with the database. Downloads require the owning teacher's session and force attachment delivery. Students cannot read raw documents or private source text in this milestone.

- PDF, UTF-8 TXT, DOCX and PPTX: 8 MB per upload, 120,000 extracted characters, 100 PDF pages/slides, 30 documents per classroom.
- Extraction accepts at most 10 selected sources totaling 120,000 characters; split larger curricula into manageable imports.
- ZIP expansion and entry sizes are bounded. XML DTD/entity definitions and encrypted archives are rejected. Embedded scripts/macros are never executed; only document/slide text is extracted.
- PDF text retains page labels; PPTX text retains slide numbers; DOCX text retains document attribution. No OCR, image analysis, legacy `.ppt` or `.doc` conversion is included. Convert these formats to supported text-bearing documents before import.
- Invalid, scanned, empty or oversized sources return actionable errors without deleting an existing draft.
- Classroom deletion cascades database rows and removes source files. If filesystem cleanup fails, it emits a generic operator log; the inaccessible orphan requires later storage maintenance.

## API

All paths are under `/api/classrooms/:id`. Mutations require a matching Origin and the active classroom's owning teacher. Reads require the owner or an enrolled student; private source/job routes require the owner.

| Method | Path                      | Behavior                                              |
| ------ | ------------------------- | ----------------------------------------------------- |
| POST   | `/sources`                | Multipart `file`, or JSON `{ filename, text }`        |
| GET    | `/sources/:sourceId`      | Private attachment download                           |
| GET    | `/curriculum`             | Role-filtered draft/approved view                     |
| PUT    | `/curriculum`             | `{ version, curriculum }` with optimistic concurrency |
| POST   | `/curriculum/generate`    | `{ sourceIds }`, returns a queued job                 |
| GET    | `/curriculum/jobs/:jobId` | Safe status/progress/error                            |
| POST   | `/curriculum/approve`     | `{ version }`, explicitly publishes saved draft       |

Curricula are limited to 20 units, 200 total concepts and 30 outcomes. Duplicate IDs, unknown prerequisites, self-links and cycles are rejected. React renders all text as escaped content. The editor adds/removes/reorders units/concepts and edits prerequisite relationships. The graph scrolls inside its own viewport on small screens and includes a text alternative.

## Verification and scope

Run the checks listed in the README. Unit tests cover file extraction, malformed files, graph validation, adapter formats and fallback. Integration tests use real PostgreSQL and Better Auth to verify source privacy, cross-classroom isolation, draft publication, concurrent edits, jobs and archive behavior. Playwright covers import, manual editing, teacher approval and student graph viewing on desktop/mobile.

Lessons are now implemented in [Milestone C](lessons.md). Assessments, mastery, RAG and analytics remain Milestones D–F. This curriculum module does not simulate student progress.
