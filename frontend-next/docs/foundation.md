# Milestone A — Foundation

The source of truth is `../AGENTS.md`. This milestone implements a Next.js modular monolith with TypeScript, a shared accessible UI system, PostgreSQL/Prisma, email/password authentication, teacher/student roles, classroom CRUD and join codes.

The earlier Python application is outside this monolith. The previous lesson-generation pages were replaced by Foundation routes. No AI provider, curriculum, lesson, assessment, mastery, tutor or analytics functionality is included.

## Modules

- `src/app`: public pages, authenticated dashboards and resource-oriented API routes.
- `src/components`: shared UI primitives and feedback.
- `src/features/auth`: typed roles, registration/login boundaries and forms.
- `src/features/classrooms`: typed classroom boundaries and forms.
- `src/server`: Better Auth, session validation, classroom domain services and HTTP boundaries.
- `src/db`: one hot-reload-safe Prisma client with the PostgreSQL adapter.
- `src/lib/messages.ts`: centralized English UI catalog, ready for locale selection later.
- `prisma`: Foundation schema and checked-in SQL migration.
- `tests`: unit, real PostgreSQL integration and desktop/mobile browser checks.

## Authentication and authorization

Better Auth owns password hashing, database-backed sessions, session cookies, origin checks on its endpoints, and auth rate limiting. The application validates signup fields with Zod. Public signup supports only teacher and student; the database enum and auth validator reject admin or arbitrary role values. Role changes through profile updates are rejected. Public teacher signup is intentional for this open university lab; deployment-specific teacher verification can be added separately.

Every protected page and API route resolves a real session and reads the current user role from the database. Client-side navigation is convenience, not access control. No session-cookie-only protection or cached authorization data is used. Auth configuration and database access are marked server-only; secrets are never included in client modules.

Teacher reads and mutations filter by `teacherId` in the database query. Student reads filter by enrollment. An inaccessible classroom returns the same 404 as a missing one. Students never receive join codes, class rosters, teacher IDs, email addresses or session/account data through classroom APIs.

Classroom mutations also require an exact configured Origin. JSON bodies are capped at 16 KiB and validated. Browser output is React text rendering; descriptions are never rendered as HTML.

## Data integrity

Classrooms have a unique, cryptographically random eight-character join code with ambiguous characters excluded. Unique constraints are authoritative; creation retries a bounded number of collisions. Enrollment has a composite classroom/student primary key. Joining is an idempotent transaction that locks the active classroom before inserting an enrollment, preventing archive/deletion races. Archived classrooms remain readable to enrolled students but do not allow new joins. Deletion is permanent and cascades enrollments in the same database statement; user accounts remain.

## Scope decisions

Classroom metadata includes name, description, academic level, teaching language, duration in weeks and active/archived status. There are no public admin controls. Email verification and password-reset email delivery are not enabled; a production deployment should configure an email service before enabling those flows. Auth rate limiting is in-process for the single-server Foundation deployment. No extra queue, Redis, vector database or AI dependency is required.

## Definition of Done mapping

Dependency audit: Next.js was upgraded to 16.4.0 to resolve the critical advisory in the original shell. npm still reports high-severity advisories in transitive Prisma/shadcn/lint tooling dependencies (including Prisma's unused MySQL driver). No forced major downgrades or unverified dependency overrides were applied. Review updated upstream releases before a production deployment.

- Authorization and classroom isolation: real-session integration tests for owners, unrelated teachers, enrolled/unenrolled students and logged-out sessions.
- Validation: Zod boundaries, role tampering, malformed/oversized JSON, invalid duration, invalid code and cross-origin mutation tests.
- Error, empty and loading states: accessible form alerts, empty classroom/roster components, dashboard skeletons and application error boundary.
- Accessibility/responsiveness: semantic headings/nav/forms, labels, field errors, focus indicators, skip link, reduced motion; browser flows at desktop and mobile widths.
- Persistence: checked-in migration and real PostgreSQL tests for unique codes, duplicate enrollment, archive and deletion behavior.
- Configuration/documentation: `.env.example`, Docker Compose, setup/test documentation and ignored local secrets.
- AI schemas/provider failures: not applicable in Milestone A; no AI endpoints or provider calls exist.
