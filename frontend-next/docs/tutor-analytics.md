# Milestones E and F — Grounded Tutor and Learning Analytics

> Current product direction: Classroom Tutor has been retired and replaced by [Curriculum slides](slides.md). The tutor UI and provider-calling endpoints described below are historical; legacy APIs now return HTTP 410 and old page links redirect to slides. Historical database data is preserved. Teacher analytics remain active, without tutor reports or tutor-question activity totals.

These milestones extend the existing curriculum, lesson, assessment and mastery features. They do not add slides, narration, voice, automatic remedial generation or other post-V1 work. Existing authoring and grading behavior is retained.

## Setup

PostgreSQL now needs the `vector` extension. The local Docker build adds pgvector to the existing PostgreSQL 17 Alpine base and reuses the same named data volume. Do not delete that volume when upgrading.

```powershell
docker compose build db
docker compose up -d --wait db
npm run db:deploy
npm run db:generate
npm run build
npm run start
```

On an external PostgreSQL installation, install pgvector and allow the migration account to create its extension before deploying. No new Node runtime dependency is needed. The native select component uses the existing UI utilities.

Configure `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, and at least one text provider. Tutor text routing uses `AI_FAST_PROVIDER` and the existing Groq fast/Gemini text model settings. All keys stay on the server. Embeddings are fixed at 768 dimensions in this schema; switching model IDs invalidates the relevant cache and requires indexing again. `TUTOR_MAX_COSINE_DISTANCE` defaults to `0.55`; lower values demand closer matches. It is a retrieval threshold, not a calibrated confidence probability.

The current local migration and production build include E/F. The user owns functional verification. Automated tests, browser checks and live provider calls were not run. New unit and isolation test cases are supplied for the user to run later; they use synthetic vectors and require no AI calls. Integration tests require the separate migrated `openlearn_test` database.

## E: Teacher workflow

1. Upload/paste sources and explicitly approve their links in **Curriculum**, using the existing workflow.
2. Open **Classroom tutor**. The **Tutor sources** panel lists only approved linked sources.
3. Click **Index source** for each source you want available to the tutor. This is an explicit Gemini embedding operation. Indexing displays queued/generating/complete/failed status and progress; retry by clicking the source's index button after failure.
4. Use the tutor with your own private history to inspect explanations. Students can now ask questions grounded in those indexed sources.
5. Inspect student-reported incorrect answers in **Learning analytics**. Reporting explicitly tells students that the question, answer and citations will be shared with the teacher.

Source indexes cache by original source hash, embedding model, dimensions and chunking version. Previously embedded batches survive failures and are reused. Each job handles one source, at most 160 chunks, in batches of 16, with at most two provider attempts per batch. The job stops starting batches after 130 seconds and expires at 180 seconds. Large or slow jobs can resume cached batches on retry. Indexing shares the existing one-active-generation-job classroom limit and three-starts-per-minute teacher limit.

Chunks respect extracted page/slide/section boundaries and prefer paragraph or sentence boundaries within 1,800 characters. A section's original label and part number accompany every chunk. Plain text without section metadata uses a document label; the system never invents page numbers.

## E: Student workflow and privacy

Open **Classroom tutor**, optionally select a published lesson as topic context, and ask a question. Each question is answered independently from approved excerpts; the latest 30 question/answer records form a private history. The tutor does not send prior conversation history, student identity, grades or assessment answers to the provider.

Question submission embeds the question with its selected published lesson title, retrieves up to six relevant excerpts, and requests a schema-validated explanation. The answer displays source filenames, section labels and exact supporting excerpts. It is explicitly labeled as AI-generated and may still be incorrect; references are evidence for review, not a guarantee that every generated claim is correct. Missing or weak retrieval returns an insufficient-evidence message without a text-generation call. An unavailable provider fails that request without disabling the rest of the classroom.

Exact repeated questions reuse a completed, unreported answer only within that user's conversation and the same source/index, curriculum, lesson, language, model and prompt configuration. Questions and explanations are rendered as escaped text. Model-provided URLs, markup and scripts are not executed. Citation IDs must belong to the retrieved excerpts. No assessment answer keys are included in retrieval.

Every read/mutation checks classroom access. Vector SQL itself filters classroom ID, current approved source IDs, matching index fingerprints/model, and teacher ownership or enrollment. Retrieval uses pgvector's exact cosine search; an approximate index is deliberately unnecessary for the current bounded classroom sources. A provider job rechecks approval and classroom access before saving its answer. Removed source approval immediately blocks new retrieval and hides historical answers/excerpts that cite it. Original raw file downloads remain teacher-only.

Only the conversation owner can read, clear or report it. The classroom teacher receives only explicitly reported records, not all student conversations. Clearing history requires confirmation and does not reset rate counters. The server permits one active question per user/classroom, at most three submitted questions per minute per user/classroom and twenty per classroom. Archived classrooms are read-only. In-process jobs expire after 180 seconds; keep the Node process alive during generation.

Page loads and status polling never invoke providers. Indexing and asking questions do. Logs include correlation ID, task, provider/model, timing, attempt count, schema validity and available token counts, without source text, questions, API keys or student responses.

## F: Teacher workflow

Open **Learning analytics** from your classroom. This page and its API are owner-only; students cannot inspect class analytics or another student's evidence.

The dashboard shows enrollment, submitted attempts, pending reviews, recorded completion of current published lesson versions, concept mastery/confidence/coverage, mastery distributions, commonly missed questions, assessment publication summaries, recent learning events and students with supported review signals.

The confusion map displays prerequisite links and evidence states. Click a concept, or use its table button, to inspect question error rate, hint rate, evidence count, mastery distribution and prerequisite concepts. Text labels and the table provide an accessible alternative to colors. Use the lesson-studio link to review or create material through the existing teacher publication workflow. This milestone does not automatically generate or publish remediation.

Analytics reuses `WeightedMasteryStrategy` and the original graded question evidence, with current recency decay. It does not substitute the latest quiz score for mastery. Pending written/coding reviews are excluded until marked. Each student has equal weight in a concept's average; repeated responses still follow the existing strategy's lower evidence weights. Learners without evidence are counted separately. A review-needed classification requires the strategy's minimum distinct-question and confidence rules, so a lone wrong answer does not label a student weak.

Question error rate counts graded responses receiving less than full credit; hint rate counts graded responses that used a hint. Assessment averages exclude attempts still awaiting review, group results by assessment publication version, and include repeated attempts. These are descriptive attempt averages, not student rankings. Mastery summaries use all recorded submitted attempts; activity totals use the last 30 days. The dashboard recomputes on page load and makes no AI calls.

## F: Learning events

`LearningEvent` records meaningful actions only:

- `lesson_started`, `block_viewed`, `checkpoint_answered`, `lesson_completed` from the student lesson player.
- `activity_attempted`, `hint_requested`, `assessment_submitted` from the authoritative attempt transactions.
- `tutor_question` from accepted tutor requests. Teacher requests count toward server limits but are excluded from student analytics.

The event service owns validation and deduplication. The lesson endpoint accepts only the four supported lesson event types, validates enrollment and the current published lesson/version/block, and requires recorded views of every block before recording completion. Events are unique per student, classroom, resource, version and action. Assessment/hint events use attempt/question keys and cannot be forged through the lesson event endpoint.

Lesson checkpoint text stays in local player state. Events contain reference metadata rather than written responses or tutor question content. Lesson completion is self-reported navigation, not a grade or demonstrated mastery. Analytics delivery failure shows a small error while allowing the lesson to remain usable. Teacher previews send no student events. Assessment events are committed atomically with their corresponding attempt changes.

Existing assessment evidence remains available in analytics; learning events are collected prospectively and historical activity is not invented. Clearing tutor history removes its question/answer/report content while preserving content-free event counts. Deleting a classroom cascades its indexes, conversations and events.

## Added routes

All API paths are under `/api/classrooms/:id` and enforce a real session. Mutation routes also enforce the configured Origin and bounded Zod-validated input.

| Method              | Path            | Access and purpose                                         |
| ------------------- | --------------- | ---------------------------------------------------------- |
| GET / POST / DELETE | `/tutor`        | Member/owner's own history, question, or history deletion  |
| POST                | `/tutor/report` | Conversation owner's incorrect-answer report               |
| GET / POST          | `/tutor/index`  | Owning teacher's index status or source indexing request   |
| POST                | `/events`       | Enrolled student's validated lesson activity               |
| GET                 | `/analytics`    | Owning teacher's classroom aggregates and reported answers |

## Manual verification

Use two classrooms, two teachers and two students. Verify private conversations, denied cross-class retrieval/analytics, approval revocation, archived read-only behavior, unchanged embedding reuse, saved attempts and teacher-review effects. Walk through a lesson and confirm deduplicated activity/completion. Inspect the map using keyboard controls and narrow screens. If you choose to spend provider quota, index one approved source and ask one sourced question plus one unsupported question. Provider failures and insufficient evidence should not affect manual authoring or grading.

Implementation references: [Gemini embedding API](https://ai.google.dev/api/embeddings) for batch request/configuration fields and [pgvector](https://github.com/pgvector/pgvector) for cosine-distance retrieval and PostgreSQL extension setup.
