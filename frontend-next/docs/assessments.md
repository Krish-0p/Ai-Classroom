# Milestone D — Assessment and Mastery

Milestone D adds teacher-authored or generated assessments, private student attempts, teacher review, and explainable concept mastery. It reuses the existing dependencies and provider adapters. The production build includes TypeScript checking; functional verification belongs to the user. No automated tests, browser checks, or live AI calls were run for this milestone.

## Setup

From `frontend-next`:

```powershell
npm run db:deploy
npm run db:generate
npm run build
npm run start
```

Use the origin configured in `BETTER_AUTH_URL` (locally `http://localhost:3000`). Keep PostgreSQL running. The lesson and assessment migrations have been applied to this workspace's local development database. Other installations must apply them using the commands above.

## Teacher workflow

1. Approve a classroom curriculum, then open **Assessments** and create a draft.
2. Add questions manually, or select approved concepts and an easy/medium/hard distribution, then request generation. Generation replaces the saved question draft and requires saved changes first.
3. Edit prompts, concept tags, difficulty, marks, answers, explanations, optional hints and written-answer rubrics. Preview the questions and answer key.
4. Set the attempt limit (1–5) and whether solutions are shown after submission, save, then publish the saved snapshot.
5. Open submitted attempts to review responses and assign marks with feedback. Short answer, explanation and coding responses require teacher review. Teachers can also correct automatic marks.

Every question has one or more approved concept tags. Up to 30 questions are allowed per assessment; generation requests allow up to 20. New draft edits remain private until explicit publication. Unpublishing or archiving stops new attempts and access to unfinished attempts; submitted history remains available to its student and teacher. Republishing restores access to an unfinished attempt's original snapshot. Attempt limits apply across publication versions.

Concepts used by draft questions, published assessments or historical attempts cannot be removed during curriculum approval. This protects existing questions and mastery evidence. Classroom archiving permits reads but prevents assessment changes, submissions and reviews.

## Student workflow

1. Open **Assessments** in an enrolled classroom and start a published assessment. An existing unfinished attempt resumes automatically.
2. Answer questions, reveal optional teacher-approved hints, and use **Save for later** to persist responses. Unsaved edits are local to the current page.
3. Submit once ready. Objective answers are graded deterministically; written and coding answers remain pending teacher review. Code is displayed and never executed.
4. View feedback and, if enabled for this attempt, solutions. Open **My progress** to see concept estimates, confidence, evidence and recent attempts, with links to published concept lessons.

MCQ and multi-select use exact answers, numerical questions use an absolute tolerance, ordering requires the complete correct order, and matching awards proportional marks for correct pairs. Blank responses receive zero. No AI calls occur during answering, hint use, scoring or progress reads.

## Mastery strategy

`MasteryStrategy` allows alternative algorithms. The initial `WeightedMasteryStrategy` uses each graded question response as evidence for its tagged concepts:

```text
accuracy = awarded marks / maximum marks
weight = difficulty × independence × recency
difficulty = 0.8 (easy), 1.0 (medium), 1.2 (hard)
independence = (0.65 if a hint was used, otherwise 1) / attempt number
recency = 0.5 ^ (age in days / 90)
mastery = (1 + sum(accuracy × weight)) / (2 + sum(weight))
confidence = min(0.95, (1 - exp(-sum(weight) / 5)) × min(1, distinct questions / 3))
```

The prior has score 0.5 and weight 2. No evidence is labeled explicitly; fewer than three distinct questions remain insufficient evidence. Repeated attempts do not count as new distinct questions. Pending teacher reviews contribute no mastery evidence until graded. Scores and confidence are estimates, not consequential grades.

Mastery records store score, confidence, evidence count and explanation on submission and review. Progress reads recompute from stored responses so recency remains current. Review changes replace the question's contribution instead of duplicating evidence. Secure status requires score at least 0.8 and confidence at least 0.6; review-needed status requires score below 0.55 and confidence at least 0.35. Other supported evidence is labeled developing.

## Persistence and access

Each attempt freezes the published assessment, question marks, concept tags and answer key. Later draft edits or publication changes cannot silently change that attempt's grading. Attempt creation, answer saving, submission and review use transactions and classroom/enrollment locks. Repeated submission returns the existing attempt rather than creating duplicate mastery evidence.

Student reads enforce classroom enrollment and ownership in database queries. Answer keys stay server-side until submission and only appear when solutions are enabled. A student cannot read another student's attempts or progress. Teacher review is limited to the classroom owner. Mutations require the configured Origin, a real session and validated input.

Question generation uses `AI_FAST_PROVIDER` and `GROQ_FAST_MODEL`, with the existing Gemini text adapter as available fallback. Inputs include selected approved concepts and linked approved sources, without student responses or personal data. Output is schema-validated and never automatically published. Existing job limits, caching, bounded retries and safe metadata logging apply. Jobs run in-process; keep the Node server running during generation. Failure or conflicting changes leave the existing draft intact.

## API

All paths below are under `/api/classrooms/:id`.

| Method             | Path                                  | Purpose                                           |
| ------------------ | ------------------------------------- | ------------------------------------------------- |
| GET / POST         | `/assessments`                        | Scoped list / create draft                        |
| GET / PATCH        | `/assessments/:assessmentId`          | Read / save versioned draft                       |
| POST               | `/assessments/:assessmentId/status`   | Publish, unpublish or archive                     |
| POST               | `/assessments/:assessmentId/generate` | Generate a question draft                         |
| POST / GET         | `/assessments/:assessmentId/attempts` | Student start/resume / teacher submitted attempts |
| GET / PATCH / POST | `/attempts/:attemptId`                | Read / save answers / submit                      |
| POST               | `/attempts/:attemptId/hint`           | Reveal and record a hint                          |
| POST               | `/attempts/:attemptId/review`         | Teacher marks and feedback                        |
| GET                | `/progress`                           | Student's own concept progress                    |

For manual verification, exercise publication privacy, all question types, save/resume, attempt limits, hints, teacher review, mastery updates and isolation between students/classrooms. AI generation is optional and consumes provider quota only when explicitly requested in the UI.

RAG tutor, teacher analytics and confusion maps are implemented in [Milestones E/F](tutor-analytics.md). Automatic adaptive remediation remains later work.
