# OpenLearn Lab

Open-source university learning platform for the ROSPL lab project. `AGENTS.md` is the project specification.

The implementation covers **Milestones A–F** in [`frontend-next`](frontend-next/README.md): authentication, classrooms, private sources, Gemini/Groq drafts, teacher approval, lessons, assessments, mastery, a source-cited classroom tutor and teacher analytics with a confusion map. Functional verification belongs to the user.

Run the monolith using `frontend-next/README.md`, building its pgvector-enabled PostgreSQL image and applying migrations first. The earlier Python prototype is not required. Manual authoring, assessment scoring, mastery and analytics work without API keys. Tutor indexing and questions require configured providers and explicit user actions. Slides, narration, voice and automatic remediation remain later work. Browser checks, automated tests and live AI checks remain skipped as requested.
