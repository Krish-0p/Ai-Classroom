# OpenLearn Lab — Classroom, Tutor and Analytics

Milestones A–F. A modular Next.js/TypeScript monolith with PostgreSQL, Prisma, Better Auth, classrooms, private document ingestion, AI curriculum/lesson/question drafts, teacher approval, knowledge graphs, lesson and assessment players, teacher review, concept mastery, a cited classroom tutor and teacher analytics. See [`../AGENTS.md`](../AGENTS.md), [Foundation decisions](docs/foundation.md), [Curriculum architecture](docs/curriculum.md), [Lesson workflow](docs/lessons.md), [Assessment and mastery workflow](docs/assessments.md) and [Tutor and analytics](docs/tutor-analytics.md).

The requested production build includes TypeScript checking. Migrations through tutor/analytics are applied to this workspace's local database. Functional verification remains with the user; no automated tests, browser checks or live AI checks were run for the latest milestones. Other installations need pgvector and must apply migrations using `npm run db:deploy`.

## Local setup

Requirements: Node.js 24 LTS, npm, and PostgreSQL (Docker Desktop is the simplest local option).

Run these commands from this directory:

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `BETTER_AUTH_SECRET` in `.env.local`. Never commit this file. Keep `BETTER_AUTH_URL` equal to the browser origin, including its port. All configuration is server-only. Configure Gemini and/or Groq keys and model IDs for AI extraction; manual curriculum editing works without them.

Password recovery uses Better Auth reset tokens and the Resend email API. Set `RESEND_API_KEY` and a verified sender address in `RESEND_FROM_EMAIL` to deliver reset links; recovery links expire after 30 minutes and password changes revoke existing sessions. The reset request response does not reveal whether an email is registered.

```powershell
npm ci
docker compose up -d --build --wait
npm run db:deploy
npm run dev
```

Open <http://localhost:3000>. Use `DATABASE_URL` to connect to an existing PostgreSQL installation instead of Docker. The Docker credentials are local development defaults, not production credentials. `npm ci` generates the Prisma client; migrations are applied explicitly. To shut down the local database without deleting its data, run `docker compose down`.

## Demo

1. Register a teacher account.
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

12. Open **Classroom tutor** as the teacher and explicitly index approved sources. Students can then ask grounded questions and inspect cited excerpts. Indexing and questions consume provider quota; merely viewing screens does not.
13. Open **Learning analytics** as the teacher to inspect mastery, review signals, assessment summaries, activity and the clickable confusion map.

There are no seeded passwords or default admin accounts. Registration fixes the teacher/student role. Slides, narration, voice and automatic adaptive remediation remain later work.

For a production build and local server, run `npm run build` followed by `npm run start`, leaving the terminal and database running.

Student learning links are available in the dashboard navigation. Select an enrolled classroom to open Curriculum, Lessons, Assessments, My progress or Classroom tutor. Before joining a classroom, the links are disabled and the join-code instructions are shown.

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
