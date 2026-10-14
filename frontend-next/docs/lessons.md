# Milestone C — Lessons

Implementation is ready for user verification. The subsequent Milestone D request authorized building the application and starting it for manual testing. The lesson migration has now been applied locally and the production build includes these screens. Automated tests, browser checks and live AI calls remain skipped.

## Setup

From `frontend-next`, apply the pending migration before starting the app:

```powershell
npm run db:deploy
npm run db:generate
npm run dev
```

The migration adds lesson/block tables, publication metadata, job lesson references, input caching hashes and separate approved curriculum source references. Existing approved curricula retain source links only when their saved draft and approval versions match. For an older approval whose draft has changed, select its source links and explicitly approve the desired curriculum again before source-grounded lesson generation.

No new runtime dependencies are required. The existing Next.js, Prisma, Better Auth, Zod, shadcn components and Gemini/Groq adapters are reused.

## Teacher workflow

1. Open a classroom's **Curriculum**. Create/edit the curriculum, choose linked sources, save and approve it.
2. Open **Lessons**, choose an approved concept and create a lesson.
3. Write blocks manually, or click **Generate lesson draft**. AI generation occurs only when explicitly requested. The optional instruction can request a teaching analogy or explanation style.
4. Edit the title, duration and blocks. Add/remove/reorder explanation, callout, example, displayed code, diagram and reflection checkpoint blocks. Diagram inputs use `ID | label` and `source ID | target ID`, one per line.
5. Lock any block that must survive regeneration. Locking prevents AI replacement; the teacher can still edit or remove it.
6. Save the draft and expand **Student preview**. Review all generated content. **Mark ready for review** is an optional status for an unpublished draft.
7. Click **Publish saved lesson** to expose that exact snapshot to enrolled students. Later draft edits remain private until another explicit publication.
8. Unpublish/archive to remove student access. Delete requires an explicit confirmation in the UI.

A concept with lessons cannot be removed from the approved curriculum. Keep the concept or delete its lessons first. Moving a concept to another unit updates its lessons' unit references within the curriculum approval transaction. Archived classrooms remain readable but reject lesson mutations.

## Student workflow

Enrolled students open **Lessons** and see published lessons only. The player displays one block at a time, provides previous/next controls, diagrams with text alternatives, displayed code and self-reflection checkpoints. Students explain an idea before revealing the self-check explanation. Responses are browser state only and are discarded when leaving that block; they are not stored, graded or used to estimate mastery.

The finish screen means the student reached the end of this player session. Milestone F now records navigation and completion for the current published lesson version, but this is not proof of understanding or mastery. Checkpoint response text remains local; only the reflection event is saved. Separate assessments provide persisted mastery evidence; see [Milestone D](assessments.md) and [E/F](tutor-analytics.md).

## Data and safety

`Lesson` references its classroom, unit and approved concept, tracks draft version/status, and stores a separately validated published JSON snapshot. `LessonBlock` stores ordered, typed draft content. Saving blocks and updating lesson metadata is transactional. Publishing/status changes use optimistic versions. Student database queries filter enrollment and published status and select only published content; they never serialize draft blocks, job instructions or source text.

AI generation uses a versioned prompt built from the approved concept, prerequisites, teaching language and approved linked sources. Documents are untrusted reference data. Generated output passes structural and diagram-reference validation. No HTML, SVG source, executable widgets or remote assets from the model are rendered. Code examples are escaped text. Application-owned diagrams render validated node/edge data.

Persisted generation jobs expose queued/generating/complete/failed states. They share the classroom's rate limits with curriculum extraction: one active job, at most three starts per minute. Unchanged inputs reuse the current generated draft. Bounded provider attempts and fallback apply to lessons too. Failure leaves the existing lesson and publication intact. A changed draft or curriculum prevents stale AI output from overwriting current work. Locked blocks are merged into the new draft; the overall 40-block limit still applies.

Jobs run in-process with `after()`, a 180-second route budget and stale-job expiration. Keep the Node process alive during generation. This implementation does not add a durable queue. Job metadata logs include task/job IDs, provider/model, latency, attempt count, token usage and schema validity, without prompts, API keys, source text or personal data.

## API

All paths are under `/api/classrooms/:id`. Teacher mutations require ownership, an active classroom and a matching Origin. Student reads require enrollment and publication.

| Method | Path                          | Input or behavior                                         |
| ------ | ----------------------------- | --------------------------------------------------------- |
| GET    | `/lessons`                    | Role-filtered lesson list                                 |
| POST   | `/lessons`                    | `{ conceptId }` creates an empty draft                    |
| GET    | `/lessons/:lessonId`          | Teacher draft or student publication                      |
| PATCH  | `/lessons/:lessonId`          | `{ version, lesson }`                                     |
| DELETE | `/lessons/:lessonId`          | Delete the lesson and its blocks/jobs                     |
| POST   | `/lessons/:lessonId/status`   | `{ version, action }`; publish/unpublish/review/archive   |
| POST   | `/lessons/:lessonId/generate` | `{ version, instruction }`; returns HTTP 202 and a job ID |
| GET    | `/jobs/:jobId`                | Owner-only safe job status                                |

## User verification checklist

- Confirm teacher ownership and student enrollment isolation using two classrooms.
- Create a manual Queue/BFS lesson and preview every block type.
- Publish; verify an enrolled student sees the snapshot. Edit/save privately; verify the student still sees the previous publication.
- Unpublish/archive; verify student direct-link access is denied.
- Confirm stale saves and publications return conflicts.
- If you choose to spend provider quota, request one generation, preserve a locked block, and verify a failed generation leaves manual content intact.
- Review keyboard navigation, mobile layouts, diagram alternatives and loading/error/empty states.

Live AI verification is optional and explicitly consumes provider quota. No AI calls occur on page loads or while authoring manually.

Slides, narration and block-level regeneration are later work. Assessments and mastery are implemented in Milestone D; tutor and analytics are implemented in Milestones E/F.
