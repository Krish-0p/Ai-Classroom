# OpenLearn Lab — Classroom, Slides and Analytics

Deploy to Vercel with Neon using the [step-by-step deployment guide](docs/deployment.md). Set the Vercel root directory to `frontend-next`; no nested repository is needed. The deployment build generates Prisma, applies migrations and builds Next.js. Small source files use database-backed storage on Vercel.

Milestones A–F plus curriculum slides. A modular Next.js/TypeScript monolith with PostgreSQL, Prisma, Better Auth, classrooms, private document ingestion, AI curriculum/lesson/question drafts, teacher approval, knowledge graphs, lesson and assessment players, teacher review, concept mastery, 4–5 editable curriculum slides and teacher analytics. Classroom Tutor has been retired. See [`../AGENTS.md`](../AGENTS.md), [Foundation decisions](docs/foundation.md), [Curriculum architecture](docs/curriculum.md), [Lesson workflow](docs/lessons.md), [Assessment and mastery workflow](docs/assessments.md) and [Curriculum slides](docs/slides.md).

The requested production build includes TypeScript checking. Migrations through teacher-owned API-key settings are applied to this workspace's local database. Functional verification remains with the user; no automated tests, browser checks or live AI checks were run for this feature. Other installations need pgvector for the preserved historical schema and must apply migrations using `npm run db:deploy`.

## Local setup

Requirements: Node.js 24 LTS, npm, and PostgreSQL (Docker Desktop is the simplest local option).

Run these commands from this directory:

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `BETTER_AUTH_SECRET` in `.env.local`. Run the command again and put the new, separate value into `AI_CREDENTIAL_ENCRYPTION_KEY`; keep that 64-character encryption secret stable. Never commit this file. Keep `BETTER_AUTH_URL` equal to the browser origin, including its port. All configuration is server-only. After signing in, each teacher opens **AI settings** and saves their own Groq key. It is encrypted in the database, never shown again, and used across that teacher's classrooms. There is no shared server-key fallback. Manual editing and student access work without API keys. See [Teacher API keys](docs/teacher-api-keys.md).

Set `GROQ_REASONING_MODEL` and `GROQ_FAST_MODEL` in `frontend-next/.env.local` to choose models; both use a centralized `openai/gpt-oss-20b` default when omitted. The root Python prototype's `.env` is not loaded by this app. Restart the app after changing server configuration. Groq uses strict structured output and a configurable 4,096-token completion limit by default. See [AI configuration](docs/curriculum.md#configuration) for output modes, reasoning effort and rate-limit handling. Curriculum slides use the teacher's Groq key too; no Gemini key, embeddings or PPTX library is needed. Saving a teacher key does not contact Groq or verify allowance.

Password recovery uses Better Auth reset tokens and the Resend email API. Set `RESEND_API_KEY` and a verified sender address in `RESEND_FROM_EMAIL` to deliver reset links; recovery links expire after 30 minutes and password changes revoke existing sessions. The reset request response does not reveal whether an email is registered.

```powershell
npm ci
docker compose up -d --build --wait
npm run db:deploy
npm run dev
```

Open <http://localhost:3000>. Use `DATABASE_URL` to connect to an existing PostgreSQL installation instead of Docker. The Docker credentials are local development defaults, not production credentials. `npm ci` generates the Prisma client; migrations are applied explicitly. To shut down the local database without deleting its data, run `docker compose down`.

## Demo

1. Register a teacher account. Open **AI settings** and save your Groq key before requesting AI generation; manual workflows do not require it.
2. Create `Data Structures & Algorithms`, academic level `Undergraduate`, language `English`, duration `12` weeks.
3. Copy its join code from the classroom detail page.
4. In another browser/profile, register a student account and join using the code.
5. Verify the student sees course details, while the teacher sees enrollment names.
6. Edit or archive the classroom as the teacher. Archived classes reject new joins while existing students keep read access.
7. Delete only a disposable demo classroom after reviewing the explicit confirmation. Its enrollments are deleted; accounts remain.

8. Open **Curriculum**, paste a syllabus or upload PDF/DOCX/PPTX/TXT sources, then select sources and extract an AI draft, or add units/concepts manually.
9. Review and edit the draft, save it, then explicitly approve it. The enrolled student sees the approved knowledge graph; later draft edits stay private.

10. Open **Lessons**, select an approved concept, create a lesson, add blocks manually or request an AI draft, save and preview it, then publish. The student can open the published block player.

11. Open **Assessments**, create questions manually or generate by concept and difficulty, review answers and publish. The student can answer, save, resume and submit. Review written/coding responses as the teacher; inspect **My progress** as the student.

12. Open **Curriculum slides** as the teacher. Edit the ready-made curriculum outline, or explicitly generate 4–5 slides with simple explanations and examples. Save, preview and publish them. Students see only the published slide player. Generation consumes provider quota; opening, editing, presenting and publishing do not.
13. Open **Learning analytics** as the teacher to inspect mastery, review signals, assessment summaries, activity and the clickable confusion map.

There are no seeded passwords or default admin accounts. Registration fixes the teacher/student role. Browser slides are implemented; binary PPTX export, narration, voice and automatic adaptive remediation remain later work. Tutor links redirect to slides, tutor APIs return HTTP 410 after access checks, and historical tutor data remains in the database without an active chat interface.

For a production build and local server, run `npm run build` followed by `npm run start`, leaving the terminal and database running.

Student learning links are available in the dashboard navigation. Select an enrolled classroom to open Curriculum, Lessons, Assessments, My progress or Curriculum slides. Before joining a classroom, the links are disabled and the join-code instructions are shown.

AI extraction requires outbound HTTPS from the Node server to the configured provider endpoints. Start the application in a normal terminal or a runtime with network access; a restricted agent sandbox can block connections with `EACCES`. Extraction now distinguishes network, timeout, credentials, model, quota and request failures from invalid generated curriculum. Error messages and diagnostic metadata exclude keys and provider response bodies.

## Verification

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Integration and browser tests require a separate local database named `openlearn_test`, configured through `TEST_DATABASE_URL`. Tests reject the normal application database and remote hosts. With the provided Docker setup:

```powershell
docker compose exec -T db psql -U openlearn -d postgres -c "CREATE DATABASE openlearn_test;"
npm run db:test:prepare
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Create the test database only once. Tests cover real Better Auth sessions, owner/member isolation, role tampering, unique codes, concurrent repeated joins, archiving, deletion, logout, and desktop/mobile teacher/student flows. Browser tests start an isolated server on port 3100, use only the test database, and save screenshots/traces under ignored `test-results/`. They create unique disposable accounts; no real accounts are touched.

## API

| Method | Endpoint                  | Access                                     |
| ------ | ------------------------- | ------------------------------------------ |
| POST   | `/api/auth/sign-up/email` | Public teacher/student registration        |
| POST   | `/api/auth/sign-in/email` | Email/password login                       |
| POST   | `/api/auth/sign-out`      | Session logout                             |
| GET    | `/api/classrooms`         | Own teaching/enrolled classrooms           |
| POST   | `/api/classrooms`         | Teacher                                    |
| GET    | `/api/classrooms/:id`     | Owner or enrolled student                  |
| PATCH  | `/api/classrooms/:id`     | Owning teacher; complete editable metadata |
| DELETE | `/api/classrooms/:id`     | Owning teacher                             |
| POST   | `/api/classrooms/join`    | Student; body `{ "code": "ABCDEFGH" }`     |

Mutation requests require an Origin matching `BETTER_AUTH_URL`. Source uploads accept multipart; other mutations accept JSON. Classroom responses do not expose authentication data, and students do not receive join codes, rosters, draft curricula or raw sources. [Curriculum API](docs/curriculum.md#api) documents the added endpoints.

## Schema changes

```powershell
npm run db:migrate -- --name descriptive_change
npm run db:generate
```

Commit the schema and migration together. Deploy with `npm run db:deploy`. Generated clients and local secrets stay ignored.
