-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "assessmentId" TEXT;

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "showSolutions" BOOLEAN NOT NULL DEFAULT true,
    "status" "LessonStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "published" JSONB,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "content" JSONB NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionConcept" (
    "questionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,

    CONSTRAINT "QuestionConcept_pkey" PRIMARY KEY ("questionId","conceptId")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "assessmentVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maximumScore" DOUBLE PRECISION NOT NULL,
    "pendingReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "maximumMarks" DOUBLE PRECISION NOT NULL,
    "conceptIds" TEXT[],
    "response" JSONB,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "marks" DOUBLE PRECISION,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryRecord" (
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceCount" INTEGER NOT NULL,
    "explanation" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasteryRecord_pkey" PRIMARY KEY ("studentId","conceptId")
);

-- CreateIndex
CREATE INDEX "Assessment_classroomId_status_idx" ON "Assessment"("classroomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Question_assessmentId_key_key" ON "Question"("assessmentId", "key");

-- CreateIndex
CREATE INDEX "QuestionConcept_conceptId_idx" ON "QuestionConcept"("conceptId");

-- CreateIndex
CREATE INDEX "Attempt_studentId_submittedAt_idx" ON "Attempt"("studentId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_assessmentId_studentId_number_key" ON "Attempt"("assessmentId", "studentId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAttempt_attemptId_questionKey_key" ON "QuestionAttempt"("attemptId", "questionKey");

-- CreateIndex
CREATE INDEX "MasteryRecord_classroomId_studentId_idx" ON "MasteryRecord"("classroomId", "studentId");

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionConcept" ADD CONSTRAINT "QuestionConcept_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionConcept" ADD CONSTRAINT "QuestionConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryRecord" ADD CONSTRAINT "MasteryRecord_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryRecord" ADD CONSTRAINT "MasteryRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryRecord" ADD CONSTRAINT "MasteryRecord_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
