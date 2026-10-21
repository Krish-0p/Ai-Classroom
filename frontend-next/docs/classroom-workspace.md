# Classroom workspace

The workspace retains OpenLearn Lab's teal, mint, cream, and neutral palette. It uses the existing Base UI shadcn components, with an additional accordion built on the already-installed Base UI package. No new runtime dependency or database migration is required.

## Navigation and layout

- Desktop: a persistent classroom selector and role-aware course rail, with a fluid content area up to 120rem wide.
- Smaller screens: navigation wraps above the content; side panels stack below or above their primary content.
- Teacher-only settings, analytics, and the student roster remain server-authorized. Students see only their own progress and published resources.

## Focused workflows

- Curriculum: source material, draft review, published curriculum, and knowledge map have separate tabs. Drafts use a unit index and expandable concepts.
- Lessons and assessments: searchable libraries with status filters for teachers and paginated results. Creation tools sit beside the library on large screens.
- Editors: select a block or question rather than opening every field simultaneously. Saving and publishing remain separate actions.
- Lesson player: reading pane, lesson outline, and themed progress indicators.
- Assessments: question navigation preserves responses locally; saving and submitting still use the existing server workflow. Teacher review has its own tab.
- Analytics: concept insights, assessment trends, and activity/support are separate views.
- Slides: generation/publishing controls alongside a preview/edit workspace, with one slide editor visible at a time.
- Students: a teacher-only searchable, paginated roster at `/dashboard/classrooms/[id]/students`.

Tab panels remain mounted to preserve local edits. Read-only classrooms can still navigate editors, without enabling their editing controls.

## Design references

Navigation and progressive disclosure were informed by [Canvas course navigation](https://community.instructure.com/en/kb/articles/660740-how-do-i-use-the-course-navigation-menu-as-an-instructor) and [Google Classroom topic organization](https://support.google.com/edu/classroom/answer/9093681?co=GENIE.Platform%3DDesktop&hl=en).

## Manual verification

Functional and browser verification remains with the project owner. Check these flows with both roles:

1. Switch classrooms and confirm the correct section stays highlighted.
2. Edit a curriculum unit, block, question, or slide; switch tabs and return before saving.
3. Save a draft, then approve/publish separately; confirm students see only published content.
4. Navigate lessons and questions; save an attempt before leaving and submit when ready.
5. Search/filter libraries and the roster, including empty results and multiple pages.
6. Inspect analytics, progress, and archived classrooms.
7. Check keyboard navigation and narrow/mobile layouts.

Production builds include TypeScript checking. No automated tests, browser checks, standalone lint/type checks, or live AI smoke calls were added to this workflow.
