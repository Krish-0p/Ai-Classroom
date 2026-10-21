# OpenLearn Lab

Open-source university learning platform for the ROSPL lab project. `AGENTS.md` is the project specification.

For Vercel + Neon, follow the [deployment guide](frontend-next/docs/deployment.md). Import this GitHub repository once and set Vercel's root directory to `frontend-next`.

The implementation covers **Milestones A–F plus curriculum slides** in [`frontend-next`](frontend-next/README.md): authentication, classrooms, private sources, Gemini/Groq drafts, teacher approval, lessons, assessments, mastery, editable four/five-slide curriculum presentations and teacher analytics with a confusion map. Classroom Tutor has been retired. Functional verification belongs to the user.

Run the monolith using `frontend-next/README.md`, building its pgvector-enabled PostgreSQL image and applying migrations first. The earlier Python prototype is not required. Manual authoring, assessment scoring, mastery, slide outlines and analytics work without API keys. Teachers enter their own Groq keys in **AI settings** for explicit generation requests; encrypted server storage requires `AI_CREDENTIAL_ENCRYPTION_KEY`. There is no shared provider-key fallback. Teachers review and publish drafts for students. No PPTX export is required. Narration, voice and automatic remediation remain later work. Browser checks, automated tests and live AI checks remain skipped as requested.
