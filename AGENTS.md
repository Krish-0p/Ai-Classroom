# AGENTS.md --- OpenLearn Lab

## 1. Project Mission

Build an open-source, AI-powered adaptive classroom and learning
laboratory for universities.

The platform serves two primary roles:

-   **Teachers** create classrooms, define/import a syllabus, approve
    the curriculum, generate learning resources, publish lessons, create
    assessments, and inspect class-level learning analytics.
-   **Students** join classrooms, consume interactive lessons, use a
    grounded AI tutor, complete activities/assessments, and receive
    adaptive remediation based on demonstrated mastery.

The product must be more than an "AI content generator." Its core loop
is:

**Teacher curriculum → generated learning experience → student
interaction → mastery measurement → adaptive remediation → teacher
insight → improved learning experience.**

The project is open source. Design every major AI capability behind
interfaces so contributors can add new LLMs, TTS engines, vector stores,
content generators, assessment types, storage backends, and learning
activities.

------------------------------------------------------------------------

## 2. Non-Negotiable Product Principles

1.  **Teacher remains in control.** AI-generated curriculum and
    important learning resources must be reviewable/editable before
    publication.

2.  **Ground educational answers in approved material.** Classroom tutor
    responses should prefer teacher-approved sources and expose
    citations/source references.

3.  **Do not treat AI scores as unquestionable grades.** AI may provide
    formative evaluation, evidence, rubric suggestions, and mastery
    estimates. Teachers own consequential grading decisions.

4.  **Adaptive learning, not generic chat.** The system should identify
    concept-level weaknesses and recommend targeted remediation.

5.  **Provider independence.** No business logic should directly depend
    on Gemini or Groq SDK calls. All calls go through provider adapters.

6.  **Open-source friendly.** Local development must be easy. Expensive
    cloud services must not be mandatory.

7.  **Privacy by design.** Never expose one student's private learning
    data to another student. Do not send secrets or unnecessary personal
    data to AI providers.

8.  **Structured AI output.** Curriculum extraction, quiz generation,
    lesson generation, concept extraction, mastery feedback, etc. should
    use validated schemas rather than parsing arbitrary prose.

9.  **Graceful degradation.** If AI/TTS/embeddings fail, the rest of the
    classroom must remain usable.

10. **Do not over-engineer V1.** Implement the core
    teacher→student→mastery loop before experimental multi-agent
    complexity.

------------------------------------------------------------------------

## 3. Available AI Providers

The initial deployment has only:

-   `GEMINI_API_KEY`
-   `GROQ_API_KEY`

Do NOT require an OpenAI or Anthropic API key.

### Preferred routing

Use environment-configurable model IDs. Never scatter model names
throughout the code.

Suggested defaults at project creation time:

``` env
GEMINI_API_KEY=
GROQ_API_KEY=

AI_PRIMARY_PROVIDER=gemini
AI_FAST_PROVIDER=groq

GEMINI_TEXT_MODEL=gemini-3.8-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts

GROQ_REASONING_MODEL=openai/gpt-oss-120b
GROQ_FAST_MODEL=openai/gpt-oss-20b
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

Model availability changes. Implement provider-level model configuration
and make model IDs replaceable without source changes.

### Recommended responsibility split

**Gemini** - multimodal document understanding - syllabus/document
analysis - structured curriculum generation - image/PDF understanding
where needed - embeddings for RAG - TTS / lesson narration - complex
lesson generation - fallback LLM

**Groq** - fast tutor responses - quiz/flashcard generation -
classification - lightweight agent/tool workflows - fast formative
feedback - speech-to-text using Whisper where useful - fallback text LLM

Do not duplicate prompts inside provider adapters. Prompts belong to
application/domain services.

------------------------------------------------------------------------

## 4. Proposed Stack

Unless the existing repository already establishes another stack,
prefer:

### Web

-   Next.js
-   TypeScript
-   React
-   Tailwind CSS
-   shadcn/ui
-   Lucide icons

### Backend

Use Next.js server routes/actions for the initial monolith. Extract a
separate service only when justified.

### Data

-   PostgreSQL
-   Prisma ORM
-   `pgvector` for embeddings if practical
-   Local/dev object storage abstraction, with S3-compatible storage as
    an optional production adapter

### Authentication

Use a mature auth library. Support: - teacher - student - optional admin

Authorization must be enforced server-side.

### Validation

-   Zod at application boundaries
-   JSON Schema / Zod schemas for structured model responses

### Testing

-   Vitest for unit/integration tests
-   Playwright for critical end-to-end flows

Avoid introducing Redis, queues, microservices, Kubernetes, or multiple
databases until workload requires them.

------------------------------------------------------------------------

## 5. Repository Architecture

Prefer a modular monolith:

``` text
src/
  app/
  components/
  features/
    auth/
    classrooms/
    curriculum/
    resources/
    lessons/
    assessments/
    tutor/
    mastery/
    analytics/
    knowledge-graph/
  ai/
    providers/
      provider.ts
      gemini.ts
      groq.ts
    router/
    schemas/
    prompts/
    agents/
    rag/
  lib/
  server/
  db/
  types/

prisma/
tests/
docs/
```

Feature modules own domain behavior. Shared AI infrastructure belongs
under `src/ai`.

Do not create a giant `ai.ts`, `utils.ts`, or 1,000-line service.

------------------------------------------------------------------------

## 6. Core Domain Model

At minimum design for:

### User

-   id
-   name
-   email
-   role
-   createdAt

### Classroom

-   id
-   teacherId
-   name
-   description
-   academicLevel
-   language
-   joinCode
-   status

### Enrollment

-   classroomId
-   studentId
-   joinedAt

### SourceDocument

-   id
-   classroomId
-   uploadedBy
-   filename
-   mimeType
-   storageKey
-   processingStatus
-   extractedText
-   metadata

### CourseUnit

-   id
-   classroomId
-   title
-   description
-   order

### Concept

-   id
-   classroomId
-   unitId
-   title
-   description

### ConceptDependency

-   conceptId
-   prerequisiteConceptId

This powers the knowledge graph.

### Lesson

-   id
-   classroomId
-   unitId
-   conceptId
-   title
-   status: draft \| review \| published \| archived
-   estimatedMinutes
-   version

### LessonBlock

Composable blocks such as: - text - callout - image - diagram -
interactive - code - video - audio - checkpoint - example - formula

Never store a lesson only as one giant HTML string.

### GeneratedResource

-   lessonId
-   type: slides \| narration \| flashcards \| notes \| worksheet \|
    infographic \| etc.
-   status
-   storage/reference
-   generation metadata

### Assessment

-   id
-   classroomId
-   lessonId/unitId
-   type
-   status
-   rubric

### Question

Support: - MCQ - multi-select - short answer - numerical - coding -
ordering - matching - explanation

Every question should be tagged to one or more concepts and difficulty.

### Attempt

-   studentId
-   assessmentId
-   startedAt
-   submittedAt
-   score
-   formativeFeedback

### QuestionAttempt

-   questionId
-   response
-   correctness
-   hintsUsed
-   attempts
-   duration
-   conceptEvidence

### MasteryRecord

-   studentId
-   conceptId
-   masteryScore
-   confidence
-   evidenceCount
-   lastUpdated

### TutorConversation / TutorMessage

Store classroom context and citations.

### LearningEvent

Generic analytics event: - userId - classroomId - lessonId - conceptId -
eventType - payload - timestamp

------------------------------------------------------------------------

## 7. Teacher Experience

### 7.1 Create Classroom

Teacher supplies: - course name - description - academic level -
duration - language - optional learning outcomes

Generate a unique join code.

### 7.2 Import Curriculum

Teacher can: - upload syllabus PDF - upload notes - upload PPT/PPTX -
upload DOCX - paste text - enter topics manually

Pipeline:

1.  store source
2.  extract/normalize content
3.  ask AI for structured units/topics/concepts/outcomes
4.  identify prerequisite relationships
5.  show editable preview
6.  teacher approves
7.  persist approved curriculum

Never publish AI-extracted curriculum automatically.

### 7.3 Knowledge Graph

Render concepts and prerequisites visually.

Example:

``` text
Graphs
  ↓
Graph Representation
  ↓
Traversal
 ↙   ↘
BFS  DFS
 ↓
Shortest Paths
 ↓
Dijkstra
```

Teacher can manually add/remove/reorder relationships.

### 7.4 Lesson Studio

Teacher selects a concept and generates a lesson.

AI may create: - lesson outline - explanations - examples - diagrams -
presentation outline/deck - narration script/audio - quiz - flashcards -
practice problems - coding activity - revision notes - teacher notes

Generated items begin as `draft`.

Lesson editor supports: - edit - regenerate selected block - regenerate
with instruction - add/remove/reorder block - lock block against
regeneration - preview as student - publish/unpublish - version history
eventually

A request such as "explain using a Mumbai local train analogy" should
regenerate only the selected block when possible.

### 7.5 Assessment Studio

Teacher can: - generate questions by concept - select difficulty
distribution - edit generated questions - set marks/rubrics - preview
answers/explanations - publish

Questions must contain concept tags so results feed mastery.

### 7.6 Teacher Dashboard

Show: - enrollment - completion - concept mastery distribution -
assessment trends - commonly missed questions - struggling concepts -
class confusion map - students needing attention - suggested remedial
topics

Avoid meaningless vanity analytics.

Teacher should be able to click a weak concept and generate a remedial
mini-lesson.

------------------------------------------------------------------------

## 8. Student Experience

### 8.1 Join Classroom

Student enters join code and sees the course home.

### 8.2 Student Dashboard

Show: - continue learning - current unit - course progress - upcoming
assessments - recommended review - weak concepts - mastered concepts -
recent feedback

Do not publicly rank students by grades.

### 8.3 Diagnostic Assessment

Optional teacher-enabled diagnostic.

Use results to initialize concept mastery and recommend starting points.

### 8.4 Lesson Player

Lessons are sequences of blocks.

Preferred rhythm:

**Explain → Visualize → Example → Interact → Check understanding →
Continue**

Support checkpoints without forcing every lesson into the same
structure.

### 8.5 "I Don't Understand" Actions

For a lesson block, student can request: - explain simpler - give an
analogy - show another example - explain visually - explain with code -
explain mathematically - ask me guiding questions - translate/explain in
another supported language

Responses must preserve lesson context and use approved classroom
sources where appropriate.

### 8.6 Grounded AI Tutor

Tutor scope: - current classroom - approved course resources - current
lesson - student's allowed learning context

RAG flow:

``` text
question
→ query embedding
→ retrieve relevant approved chunks
→ construct bounded context
→ LLM
→ answer + citations
```

Tutor UI should show source references such as: - Lecture 4 --- Slide
12 - Teacher Notes --- Page 6 - BFS Lesson --- Example 2

If evidence is insufficient, say so rather than fabricate a
course-specific answer.

### 8.7 Practice and Feedback

After checkpoints/assessments: - show useful explanation - identify
concepts involved - record evidence - update mastery - recommend
targeted remediation

### 8.8 Adaptive Learning

Example:

``` text
BFS score is low
→ evidence shows Queue concept weakness
→ recommend Queue refresher
→ interactive queue activity
→ 3 targeted questions
→ reassess BFS
```

Do not adapt from a single wrong answer unless confidence is low and the
recommendation is lightweight.

### 8.9 Teach-Back Mode

Student explains a concept using text initially; voice can follow.

AI evaluates against a teacher-approved concept rubric: - correctly
explained ideas - missing ideas - misconceptions - follow-up question

This is formative feedback, not authoritative grading.

### 8.10 Viva Mode

Later phase: - AI asks teacher-approved or generated oral questions -
student answers by voice - speech is transcribed - AI asks context-aware
follow-ups - report contains rubric-based evidence and uncertainty -
teacher can review transcript/results

------------------------------------------------------------------------

## 9. Mastery Engine

Do not define mastery as `latestQuizScore`.

Represent mastery per student per concept from multiple pieces of
evidence.

Potential evidence: - question correctness - question difficulty -
repeated attempts - hint usage - checkpoint results - delayed recall -
assignment evidence - teach-back evaluation - tutor-assisted vs
independent success - recency

Initial implementation can use an explainable weighted heuristic.

Example conceptual approach:

``` text
mastery =
  weighted correctness
  × difficulty adjustment
  × independence adjustment
  × recency factor
```

Normalize to `0..1`.

Store: - score - confidence - evidence count - explanation/reasons

Later contributors may add Bayesian Knowledge Tracing or other models
behind a `MasteryStrategy` interface.

Never make the algorithm opaque to teachers.

------------------------------------------------------------------------

## 10. Confusion Map

Aggregate concept difficulty at classroom level without exposing private
student responses.

For each concept calculate signals such as: - average mastery -
percentage below threshold - common misconception tags - question error
rate - hint rate

Teacher sees a knowledge graph heat map.

Clicking a weak node shows: - evidence - affected prerequisite
concepts - commonly missed questions - suggested remediation - button to
generate remedial lesson

------------------------------------------------------------------------

## 11. RAG and Document Processing

### Ingestion

1.  validate file type/size
2.  securely store
3.  extract text
4.  preserve useful metadata:
    -   document
    -   page
    -   slide
    -   heading
    -   section
5.  chunk semantically
6.  create embeddings
7.  store chunks + vectors
8.  mark document ready

### Retrieval

Filter by classroom and only approved/visible resources.

Retrieve top relevant chunks and optionally rerank.

Every retrieved chunk must retain citation metadata.

### Security

A student from Classroom A must never retrieve chunks from Classroom B.

Enforce classroom ID in the database query itself, not only in the
prompt.

------------------------------------------------------------------------

## 12. AI Provider Interface

Create an abstraction similar to:

``` ts
interface AIProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<T>(
    input: GenerateStructuredInput<T>
  ): Promise<T>;
}
```

Separate optional capabilities:

``` ts
interface EmbeddingProvider {
  embed(input: string[]): Promise<number[][]>;
}

interface TTSProvider {
  synthesize(input: TTSInput): Promise<TTSResult>;
}

interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
```

Implement: - `GeminiProvider` - `GroqProvider` -
`GeminiEmbeddingProvider` - `GeminiTTSProvider` -
`GroqTranscriptionProvider`

Do not pretend every provider supports every modality.

The router chooses capability/provider based on configuration.

------------------------------------------------------------------------

## 13. AI Router

Create task classes rather than asking UI code to choose a model.

Example tasks:

``` text
CURRICULUM_EXTRACTION
LESSON_GENERATION
QUIZ_GENERATION
TUTOR_RESPONSE
CONCEPT_CLASSIFICATION
MASTERY_FEEDBACK
TEACH_BACK_EVALUATION
EMBEDDING
TTS
TRANSCRIPTION
```

Configuration maps task → provider/model.

This allows contributors to swap providers later.

Fallback behavior: - retry transient errors with bounded exponential
backoff - use configured fallback where safe - never retry validation
failures endlessly - return user-friendly errors - log
provider/model/latency/token metadata without logging secrets

------------------------------------------------------------------------

## 14. Structured AI Schemas

Use schemas for all machine-consumed AI output.

Examples:

### CurriculumExtraction

``` ts
const CurriculumExtractionSchema = z.object({
  courseTitle: z.string(),
  learningOutcomes: z.array(z.string()),
  units: z.array(z.object({
    title: z.string(),
    description: z.string(),
    concepts: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      prerequisiteIds: z.array(z.string())
    }))
  }))
});
```

### GeneratedQuestion

Include: - prompt - type - options when relevant - correct answer -
explanation - concept IDs - difficulty - rubric when relevant

Validate all model output before persistence.

On schema failure: 1. retry once with correction context if appropriate
2. otherwise fail cleanly 3. never persist malformed data

------------------------------------------------------------------------

## 15. Agent Architecture

Do NOT start by building autonomous agents that endlessly call one
another.

Use bounded, observable workflows.

Potential agents:

### Curriculum Planner

Input: approved syllabus/source material\
Output: units, concepts, outcomes, prerequisites

### Lesson Author

Input: concept + outcomes + sources\
Output: structured lesson blocks

### Assessment Author

Input: concept/outcomes/difficulty\
Output: validated questions/rubrics

### Tutor

Input: student question + retrieved approved sources\
Output: answer + citations + optional follow-up

### Learning Diagnostician

Input: mastery evidence\
Output: misconception hypotheses + remediation recommendations

### Verifier

Input: generated educational content + supporting sources\
Output: claims/issues/verification status

Agents must: - have a narrow responsibility - have explicit input/output
schemas - have bounded steps - never recursively spawn uncontrolled
work - record execution metadata - fail independently

V1 may implement these as normal services with LLM calls. "Agent" is an
architectural role, not a requirement for an agent framework.

------------------------------------------------------------------------

## 16. Slides / Presentation Generation

Do not ask the LLM to return a binary PPTX.

Pipeline:

``` text
lesson/concept
→ structured presentation JSON
→ deterministic renderer
→ PPTX
```

Presentation schema: - title - learning objectives - slides\[\] - slide
type - heading - bullets/body - speaker notes - visual specification -
source references

Use a deterministic PPTX library in the application language.

Generated decks should remain editable.

Teacher can regenerate one slide without rebuilding the entire lesson.

------------------------------------------------------------------------

## 17. TTS

Narration pipeline:

``` text
lesson blocks
→ narration script
→ teacher preview/edit
→ TTS
→ audio asset
→ lesson player
```

Store the script separately from generated audio.

TTS must be optional.

Do not regenerate audio if the underlying script has not changed.

------------------------------------------------------------------------

## 18. Interactive Labs

Design an `InteractiveActivity` contract so contributors can add
activities.

Initial activity types: - algorithm visualizer - ordering/sequencing -
matching - graph traversal - code runner later - parameter simulation
later

Activity definition should be serializable JSON and render through
registered React components.

Example:

``` ts
type InteractiveActivityDefinition = {
  type: string;
  version: number;
  config: unknown;
  conceptIds: string[];
};
```

Validate `config` with an activity-specific schema.

Do not execute AI-generated JavaScript directly in the browser.

------------------------------------------------------------------------

## 19. Learning Event System

Track meaningful events:

``` text
lesson_started
lesson_completed
block_viewed
checkpoint_answered
hint_requested
tutor_question
activity_attempted
assessment_submitted
flashcard_reviewed
teach_back_completed
```

Events should feed analytics and mastery without tightly coupling UI
components to analytics logic.

Avoid invasive tracking unrelated to learning.

------------------------------------------------------------------------

## 20. Accessibility

Treat accessibility as a feature, not polish.

Requirements: - keyboard navigation - semantic HTML - sufficient
contrast - captions/transcripts for audio - alt text for meaningful
images - reduced-motion support - screen-reader labels - no learning
interaction that requires color alone - responsive UI

------------------------------------------------------------------------

## 21. Internationalization

Architecture should support multiple UI/content languages.

Do not hardcode English strings throughout components.

Student explanation language can differ from source language.

Preserve original terminology where translation could create technical
ambiguity.

------------------------------------------------------------------------

## 22. Security Requirements

-   API keys only on server.
-   Never expose provider keys to client bundles.
-   Validate authorization on every protected server action/route.
-   Classroom membership checks are mandatory.
-   Teacher-only mutations require teacher ownership.
-   Sanitize rendered rich text.
-   Validate uploads.
-   Apply file size/type limits.
-   Rate-limit expensive AI endpoints.
-   Protect against prompt injection from uploaded documents by treating
    document content as untrusted data, not system instructions.
-   Never execute code extracted from documents.
-   Avoid storing raw secrets in logs.
-   Use signed/authorized asset access where appropriate.

------------------------------------------------------------------------

## 23. AI Safety / Educational Integrity

The system should: - distinguish source-backed statements from generated
explanations - show uncertainty when appropriate - avoid inventing
citations - never claim teacher approval before approval - make
answer-reveal policies configurable - support hints/Socratic guidance
before final answers where teacher chooses - record AI-generated status
for resources - allow reporting incorrect content

When a tutor is instructed by retrieved text to ignore system rules,
treat it as document content, not instruction.

------------------------------------------------------------------------

## 24. Background Jobs

Generation can take time.

Design generation jobs with: - id - type - status - progress - input -
output reference - error - createdBy - timestamps

Initial implementation may process jobs in-process for simplicity, but
the domain/API should permit migration to a real queue later.

UI should display: - queued - generating - complete - failed - retry

Never make users wonder whether a generation button worked.

------------------------------------------------------------------------

## 25. Caching and Cost Control

-   cache embeddings
-   hash source content
-   reuse unchanged generated artifacts
-   do not call LLMs on every page load
-   do not regenerate resources unless inputs changed
-   rate-limit per user/classroom
-   track token/AI usage metadata
-   allow teacher to cancel generation when possible
-   use cheaper/faster configured models for classification/simple
    transformations
-   reserve stronger models for complex generation

------------------------------------------------------------------------

## 26. Observability

For AI operations log: - task type - provider - model - duration -
success/failure - retry count - token usage where available - schema
validation status

Never log: - API keys - passwords - full sensitive student content
unnecessarily

Give every generation workflow a correlation/job ID.

------------------------------------------------------------------------

## 27. UI Design Direction

Aim for: - modern university learning platform - clean, spacious
interface - visually appealing but not childish - excellent dark/light
mode eventually - cards only where useful - clear hierarchy - accessible
charts - interactive knowledge maps - polished empty/loading/error
states

Teacher and student navigation should be different.

Suggested teacher nav:

``` text
Overview
Curriculum
Lessons
Assessments
Students
Analytics
Resources
Settings
```

Suggested student nav:

``` text
Home
Learn
Practice
Tutor
Progress
Resources
```

------------------------------------------------------------------------

## 28. V1 Scope --- Build This First

A usable V1 must support this demo:

1.  teacher registers/logs in
2.  teacher creates classroom
3.  teacher uploads or pastes syllabus
4.  AI extracts structured curriculum
5.  teacher edits/approves it
6.  knowledge graph is generated
7.  teacher selects one concept
8.  AI generates structured lesson
9.  AI generates quiz
10. teacher reviews and publishes
11. student joins via code
12. student completes lesson
13. student completes quiz
14. concept mastery updates
15. student asks grounded tutor a question
16. tutor responds with course-source citations
17. teacher dashboard shows class mastery/weak concepts

If a proposed feature does not improve this loop, it is probably
post-V1.

------------------------------------------------------------------------

## 29. V2

-   flashcards
-   spaced repetition
-   TTS narration
-   PPTX generation
-   block-level regeneration
-   better teacher analytics
-   confusion map
-   adaptive remediation
-   diagnostic quiz
-   multilingual explanations

------------------------------------------------------------------------

## 30. V3+

-   teach-back mode
-   voice viva
-   interactive simulations
-   secure coding labs
-   collaborative study rooms
-   richer agent workflows
-   teacher-style personalization
-   plugin SDK
-   LMS interoperability
-   optional local-model/Ollama adapter
-   advanced mastery strategies
-   reusable community content packs

------------------------------------------------------------------------

## 31. API Style

Prefer resource-oriented APIs/actions with clear authorization.

Examples:

``` text
POST   /api/classrooms
POST   /api/classrooms/:id/join
POST   /api/classrooms/:id/sources
POST   /api/classrooms/:id/curriculum/extract
POST   /api/classrooms/:id/curriculum/approve
POST   /api/lessons/:id/generate
POST   /api/lessons/:id/publish
POST   /api/assessments/:id/submit
POST   /api/classrooms/:id/tutor
GET    /api/classrooms/:id/analytics
GET    /api/students/me/mastery
```

Do not expose arbitrary "run agent" endpoints to clients.

------------------------------------------------------------------------

## 32. Coding Rules for Codex

When modifying this repository:

1.  Inspect existing architecture before writing code.
2.  Preserve established patterns unless there is a clear reason to
    improve them.
3.  Make small, coherent changes.
4.  Prefer typed domain models.
5.  Avoid `any`.
6.  Validate external input.
7.  Handle loading/error/empty states.
8.  Add tests for important business logic.
9.  Do not silently catch errors.
10. Do not hardcode API keys, model IDs, user IDs, classroom IDs, or
    URLs that belong in configuration.
11. Never commit `.env`.
12. Update `.env.example` when adding configuration.
13. Do not add a dependency when a small implementation is sufficient.
14. Keep AI prompts versionable and separate from UI components.
15. Validate model output.
16. Do not directly trust model-generated HTML, SQL, JavaScript, or
    shell commands.
17. Keep provider-specific logic inside adapters.
18. Keep server secrets out of client components.
19. Use database transactions for multi-record operations that must
    remain consistent.
20. Run formatting, linting, type checking, and relevant tests before
    considering work complete.

------------------------------------------------------------------------

## 33. Definition of Done

### Current verification ownership

The user owns functional verification and has requested no automated tests, browser checks, standalone lint/type checks, or live AI smoke calls to conserve API limits. The latest request explicitly authorizes building the next milestone and leaving the application running for manual testing, including applying its migrations and generating the Prisma client. Run the requested production build (which includes TypeScript checking) and application server; do not interpret that as authorization for tests or live AI calls. Report build results separately from functional verification, which remains with the user.

A feature is not done merely because the happy path renders.

Before completion verify:

-   authorization
-   validation
-   error state
-   loading state
-   empty state
-   responsive behavior
-   accessibility basics
-   tests where appropriate
-   no leaked secrets
-   no cross-classroom data access
-   AI output schema validation
-   provider failure handling
-   migration/schema updates
-   documentation/config updates

------------------------------------------------------------------------

## 34. How Codex Should Approach Large Requests

For large features:

1.  inspect repository
2.  identify affected modules
3.  write a concise implementation plan
4.  implement the smallest vertical slice
5.  run checks/tests
6.  fix failures
7.  summarize changed files and remaining work

Do not replace working architecture wholesale unless explicitly
requested.

If a requirement is ambiguous, choose the simplest architecture
compatible with this document and state the assumption.

------------------------------------------------------------------------

## 35. First Development Milestone

If the repository is empty, build in this order:

### Milestone A --- Foundation

-   Next.js + TypeScript
-   UI system
-   PostgreSQL/Prisma
-   auth
-   roles
-   classroom CRUD
-   join codes

### Milestone B --- Curriculum

-   source upload/paste
-   text extraction
-   Gemini/Groq provider adapters
-   structured curriculum extraction
-   teacher approval UI
-   concept/prerequisite storage
-   knowledge graph

### Milestone C --- Lessons

-   lesson/block model
-   lesson generation
-   lesson editor
-   publish workflow
-   student lesson player

### Milestone D --- Assessment + Mastery

-   question generation
-   assessment player
-   attempts
-   mastery heuristic
-   student progress UI

### Milestone E --- RAG Tutor

-   chunking
-   Gemini embeddings
-   pgvector retrieval
-   source citations
-   tutor UI
-   strict classroom isolation

### Milestone F --- Analytics

-   learning events
-   teacher mastery dashboard
-   weak-concept analysis
-   confusion map

After these milestones, add PPT/TTS/adaptive remediation and other
advanced features.

------------------------------------------------------------------------

## 36. Initial Demo Scenario

Use Data Structures as seed/demo content.

Class: `Data Structures & Algorithms`

Unit: `Graph Algorithms`

Concepts: - Graph fundamentals - Graph representation - Queue
prerequisite - BFS - Stack/recursion prerequisite - DFS - Weighted
graphs - Dijkstra - Minimum spanning trees - Prim - Kruskal

The demo should clearly show:

**teacher uploads syllabus → curriculum graph → BFS lesson generated →
teacher publishes → student learns → quiz exposes queue weakness →
mastery changes → tutor helps using approved sources → teacher sees
weakness in analytics.**

This scenario is the product's north-star demo.

------------------------------------------------------------------------

## 37. Product North Star

Every implementation decision should support this question:

> Does this help a teacher create a trustworthy learning experience,
> help a student understand a concept, or help the system identify what
> should be taught next?

If not, it is probably not a priority.
