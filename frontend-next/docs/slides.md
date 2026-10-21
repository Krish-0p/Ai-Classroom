# Curriculum slides

Curriculum slides replace Classroom Tutor. Teachers turn the approved classroom curriculum into a short browser presentation with four or five slides. Each slide has a heading, simple explanation, up to four key points, an optional illustrative example, a takeaway and references to approved concept keys. No binary PPTX, embeddings, generated HTML or executable content is used.

## Setup and workflow

Apply `npm run db:deploy`, generate the client with `npm run db:generate`, and restart the application. The additive migration creates `SlideDeck`; it does not delete tutor conversations, source indexes or historical learning events.

1. Approve the curriculum and open **Curriculum slides** in the classroom navigation.
2. A five-slide outline is available immediately without an AI call. Edit it manually, or choose four/five slides and explicitly generate a simpler explanation using the configured fast text provider.
3. Review the slide preview and edit headings, explanations, key points, examples and takeaways. Save the draft before publishing or regenerating. Regeneration replaces only the draft, never the published presentation.
4. Publish the saved draft for enrolled students. Students get the published snapshot only, with keyboard-accessible slide tabs, previous/next controls and optional browser full-screen presentation.
5. Unpublish to remove student access while retaining the editable draft.

Generated explanations and examples are AI-assisted and require teacher review. Curriculum concept references are validated locally and constrained in the generation schema. The prompt treats supplied material as untrusted data. Text is rendered through React; no raw HTML, external media or script execution is supported.

## Storage and authorization

One deck belongs to each classroom. Draft and published snapshots are stored separately, with optimistic versions, the curriculum version and AI provenance. Teacher mutations lock the owned active classroom and validate versions inside a transaction. Generation refuses to overwrite a draft edited during the request or to save against a changed curriculum. Publishing a stale draft requires updating/saving it or regenerating it against the current approved curriculum first.

Student reads filter classroom enrollment in the database and select only published fields. Teacher reads require ownership. Archived classrooms remain readable but disallow mutations. No source files, draft slides, provider metadata or other students' data are sent to students.

`SLIDES_GENERATION` reuses persisted generation jobs, teacher-only status polling, existing classroom generation concurrency limits and the per-user/classroom start limit. Requests are explicit; page loads never call AI. An unchanged generated draft is reused when the input fingerprint and current draft hash match. Provider failures preserve the draft and published content, with safe actionable errors. The manual outline remains usable without keys.

## API

All paths are under `/api/classrooms/:id`.

| Method | Path               | Purpose                                  |
| ------ | ------------------ | ---------------------------------------- |
| GET    | `/slides`          | Role-filtered draft or published view    |
| PATCH  | `/slides`          | Save a validated versioned teacher draft |
| POST   | `/slides/generate` | Queue a four/five-slide draft            |
| POST   | `/slides/status`   | Publish or unpublish the saved draft     |
| GET    | `/jobs/:jobId`     | Owner-only generation status             |

Legacy tutor page URLs redirect to the slides page. Tutor, indexing and reporting API routes return HTTP 410 after authentication and classroom access checks; they cannot trigger provider calls. Tutor reports have been removed from analytics. Internal legacy modules and historical tables remain for data preservation and a possible later migration, but no user-facing route invokes them.

## Verification

The production build includes TypeScript checking. Functional verification belongs to the user. No automated tests, browser checks or live AI calls are required for this change. Manually verify teacher/student isolation, private drafts, generation failure/retry, saved draft publication, unpublication, stale/concurrent edits, archived classroom behavior and mobile/keyboard presentation controls.
