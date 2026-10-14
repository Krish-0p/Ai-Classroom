CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "SourceIndex" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceChunk" (
    "id" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(768),

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorConversation" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "lessonId" TEXT,
    "answer" TEXT NOT NULL DEFAULT '',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceIndex_classroomId_ready_idx" ON "SourceIndex"("classroomId", "ready");

-- CreateIndex
CREATE UNIQUE INDEX "SourceIndex_sourceId_fingerprint_key" ON "SourceIndex"("sourceId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "SourceChunk_indexId_ordinal_key" ON "SourceChunk"("indexId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "TutorConversation_classroomId_userId_key" ON "TutorConversation"("classroomId", "userId");

-- CreateIndex
CREATE INDEX "TutorMessage_conversationId_createdAt_idx" ON "TutorMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TutorMessage_conversationId_requestId_key" ON "TutorMessage"("conversationId", "requestId");

-- CreateIndex
CREATE INDEX "LearningEvent_classroomId_type_createdAt_idx" ON "LearningEvent"("classroomId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEvent_classroomId_userId_dedupeKey_key" ON "LearningEvent"("classroomId", "userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "SourceIndex" ADD CONSTRAINT "SourceIndex_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceIndex" ADD CONSTRAINT "SourceIndex_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceChunk" ADD CONSTRAINT "SourceChunk_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "SourceIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorConversation" ADD CONSTRAINT "TutorConversation_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorConversation" ADD CONSTRAINT "TutorConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TutorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
