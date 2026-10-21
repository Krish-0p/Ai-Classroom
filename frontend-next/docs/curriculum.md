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

Each teacher saves their own Groq key under **AI settings**. Active curriculum, lesson, assessment, and slide generation uses only that teacher's encrypted key; it does not fall back to global Groq or Gemini credentials. Configure the separate server `AI_CREDENTIAL_ENCRYPTION_KEY` before saving keys. See [Teacher API keys](teacher-api-keys.md) for storage, deployment, and removal details. `GROQ_REASONING_MODEL` and `GROQ_FAST_MODEL` remain environment-configurable, with a centralized `openai/gpt-oss-20b` default when omitted. Curriculum slides do not need embeddings; Classroom Tutor has been retired. Missing keys or invalid provider configuration leave manual authoring usable. The provider-independent adapter/router interfaces remain available for future provider support.

Gemini uses JSON Schema output. Groq defaults to strict JSON Schema output on supported models (GPT-OSS 20B and 120B). Set `GROQ_STRUCTURED_OUTPUT_MODE=json_object` for models without strict schema support. Both outputs undergo the same local Zod and graph validation, including semantic rules that JSON Schema cannot enforce. Corrections receive the specific validation failures rather than a generic instruction. Metadata includes bounded validation paths/codes, never generated content.

Groq completions default to 4,096 tokens (`GROQ_MAX_COMPLETION_TOKENS`); GPT-OSS reasoning defaults to `low` (`GROQ_REASONING_EFFORT`). Increase the token limit for larger drafts only within the model and account limits, or select fewer sources. A truncated completion reports an output-limit error rather than retrying malformed JSON. Small total usage does not rule out per-minute token limits.

Each provider has at most two attempts (transient retry or one schema correction). The shared router supports fallback, but active teacher-owned-key generation supplies only Groq and never uses a shared key. Transient retries use bounded exponential backoff with jitter. HTTP 429 is not immediately retried against the same provider; a valid `Retry-After` header is included in the error and diagnostic metadata. Error bodies are bounded and discarded after extracting an allowlisted error code; provider messages and generated failed content are never logged. Requests time out after 20 seconds. Metadata logs contain provider/model, latency, attempt, token count and schema result; never keys, source text, prompts or personal data.

Extraction returns HTTP 202 with a job ID. Next.js `after()` runs the task; the teacher panel polls a persisted status. Jobs survive page navigation. If the process exits, a pending job expires after three minutes and can be retried. This is a small single-process implementation, not a durable worker queue. Keep the Node server alive and allow route duration of 180 seconds. One extraction per classroom at a time; at most three starts per minute. Sources are deduplicated by classroom/content hash.

## Source storage and limits

Local files are stored under `SOURCE_STORAGE_DIR` (default `.data/sources`), using generated UUID names, outside public assets and build tracing. `SOURCE_STORAGE_PROVIDER=database` uses private Postgres `bytea` rows; this is also the automatic default on Vercel, where local upload storage is rejected. Keys retain their backend identity. `SourceStorage` allows adding an S3-compatible adapter later. Back up the selected storage along with the database. Downloads require the owning teacher's session and force attachment delivery. Students cannot read raw documents or private source text in this milestone.

- PDF, UTF-8 TXT, DOCX and PPTX: 4 MiB per upload, 120,000 extracted characters, 100 PDF pages/slides, 30 documents per classroom. The upload cap leaves room under Vercel's 4.5 MB function payload limit.
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
