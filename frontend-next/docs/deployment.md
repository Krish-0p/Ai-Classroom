# Deploy on Vercel with Neon

The GitHub repository contains the whole project. `frontend-next` is a normal directory in that repository, not a nested Git repository or submodule. Deploy that directory; the older Python prototype is not needed.

## 1. Create the database

1. Sign in at [Neon](https://console.neon.tech) and create a project, for example `openlearn`.
2. Choose a region close to the Vercel function region. Keep the default database and owner role.
3. Click **Connect**. Copy the connection string with **Connection pooling enabled**. This is `DATABASE_URL`; its hostname contains `-pooler`.
4. Turn connection pooling off and copy the direct connection string. This is `DIRECT_URL` for migrations. Keep the SSL parameters Neon provides on both URLs. Copy the URLs only, not a surrounding `psql` command.

You do not need to create tables manually. The deployment build applies the committed migrations, including `CREATE EXTENSION IF NOT EXISTS vector` for the retained historical schema. Neon supports pgvector. Use a new, dedicated database for this app.

## 2. Import the GitHub repository

1. Sign in at [Vercel](https://vercel.com/new) using GitHub.
2. Import `Krish-0p/Ai-Classroom` and deploy branch `main`.
3. Set **Root Directory** to `frontend-next`.
4. Use framework **Next.js**, Node.js **24.x**, install command `npm ci`, and build command `npm run build:deploy`.
5. Leave the output directory at the Next.js default. `frontend-next/vercel.json` already declares the framework and commands, and `package.json` pins Node 24.x.

Do not deploy the repository root as a Python app, create another Git repository, run `git init` in `frontend-next`, or select static export.

## 3. Add environment variables

Add these in the Vercel import screen or under **Settings → Environment Variables**, for **Production**. Replace the placeholders; do not paste real credentials into GitHub or chat.

```dotenv
DATABASE_URL=<Neon pooled connection URL>
DIRECT_URL=<Neon direct connection URL>
BETTER_AUTH_URL=https://<your-production-domain>
BETTER_AUTH_SECRET=<new random secret of at least 32 characters>
AI_CREDENTIAL_ENCRYPTION_KEY=<separate random 64-character hexadecimal secret>
SOURCE_STORAGE_PROVIDER=database
GROQ_REASONING_MODEL=openai/gpt-oss-20b
GROQ_FAST_MODEL=openai/gpt-oss-20b
```

Generate a fresh production authentication secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run that command a second time to generate a **different** secret for `AI_CREDENTIAL_ENCRYPTION_KEY`. This is an application encryption secret, not a Groq API key. Keep it private and stable. Losing or replacing it means teachers must re-enter their saved keys. It must be exactly 64 hexadecimal characters; do not prefix it with `NEXT_PUBLIC_`.

Each teacher signs in, opens **AI settings**, and pastes their own Groq API key. It is encrypted in the database and is never returned by the settings API. Curriculum, lesson, assessment, and slide generation use only the requesting teacher's saved key, including in background jobs. There is no fallback to `GROQ_API_KEY` or Gemini. You do not need to put a shared Groq key in Vercel. Saving a key performs syntax validation only; it does not contact Groq or confirm quota.

`BETTER_AUTH_URL` must be the final production browser origin, including `https://`, not localhost or a Git commit's temporary deployment URL. Use the production domain shown for your Vercel project. If the first deploy gets a different domain than expected, update this variable and redeploy before registering.

The root prototype `.env` and local `frontend-next/.env.local` are ignored by Git; Vercel does not receive their secrets. No Gemini, OpenAI or Anthropic key is required. Global provider-selection and API-key environment settings are retained for legacy adapters but do not control active teacher generation. Groq reasoning effort, structured output mode and completion limit have code defaults (`low`, `json_schema`, `4096`). Teacher credentials are sent only to the official Groq endpoint, not an overridden provider base URL.

Password-reset emails are optional for initial deployment. To enable them, also configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` with a verified sender. Registration and login do not require Resend.

## 4. Deploy

Click **Deploy**. The build command runs:

```text
prisma generate && prisma migrate deploy && next build
```

The runtime connects through pooled `DATABASE_URL`; Prisma migrations use `DIRECT_URL` when set. For local development, the CLI falls back to `DATABASE_URL` when `DIRECT_URL` is empty.

Keep Fluid Compute enabled so the existing Next.js `after()` generation jobs can complete within their configured 180-second route durations. These are bounded in-process jobs, not a durable queue; a timed-out/interrupted job can be retried from its saved status.

Do not share production database credentials with Preview deployments. The deployment build applies migrations, so a preview needs a separate Neon database/branch and its own authentication URL/secret. Production-only variables intentionally do not make previews usable.

## 5. Open and manually verify

Open the production domain, register a teacher, open **AI settings**, save the teacher's Groq key, create a classroom, paste a syllabus or upload a small file, approve the curriculum, generate/review/publish slides, and verify student access in another browser profile. Generating AI content consumes that teacher's provider allowance; other verification can be done with manual authoring. Students do not need an API key.

Local users, classrooms and disk files are not automatically copied to Neon. This deployment starts with a new database unless you separately migrate existing data. Existing local files must be migrated as well if you later copy local database rows that reference them.

## Storage and limits

Vercel has no persistent local application disk. On Vercel, uploads use the `DatabaseSourceStorage` adapter and are stored as private `bytea` rows in Neon. Local development continues using `.data/sources` unless you explicitly select database storage. Storage keys include the backend, so switching adapters does not silently reinterpret old keys. Download routes still enforce teacher ownership before reading file bytes.

The shared upload limit is 4 MiB, leaving space under Vercel's 4.5 MB function request/response cap. Files remain subject to existing type, text and extraction limits. Large documents must be split or pasted as text. Storing files in Postgres is a simple small-classroom/demo option and counts toward database storage; the `SourceStorage` interface remains available for an S3-compatible adapter when larger workloads require it.

## Readiness and remaining verification

The repository has a production build, Node version pin, deployment command, committed migrations, server-only provider configuration, owner/member authorization and persistent serverless-compatible source storage. No credentials belong in the commit.

Local build/migration results do not verify your future Neon/Vercel credentials, actual hosted PDF extraction or provider quota. Functional checks remain manual, per project instructions. No automated tests, browser checks or live AI smoke calls are required for this deployment preparation.

References: [Vercel build settings](https://vercel.com/docs/builds/configure-a-build), [Vercel function limits](https://vercel.com/docs/functions/limitations), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Neon and Prisma](https://neon.com/docs/guides/prisma), [Neon pgvector](https://neon.com/docs/extensions/pgvector).
