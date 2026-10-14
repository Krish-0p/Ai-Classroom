-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'ready',
    "extractedText" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curriculum" (
    "classroomId" TEXT NOT NULL,
    "draft" JSONB,
    "draftVersion" INTEGER NOT NULL DEFAULT 0,
    "sourceIds" TEXT[],
    "approved" JSONB,
    "approvedVersion" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("classroomId")
);

-- CreateTable
CREATE TABLE "CourseUnit" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CourseUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptDependency" (
    "conceptId" TEXT NOT NULL,
    "prerequisiteConceptId" TEXT NOT NULL,

    CONSTRAINT "ConceptDependency_pkey" PRIMARY KEY ("conceptId","prerequisiteConceptId")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "task" TEXT NOT NULL DEFAULT 'CURRICULUM_EXTRACTION',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL,
    "sourceIds" TEXT[],
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_classroomId_contentHash_key" ON "SourceDocument"("classroomId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "CourseUnit_classroomId_key_key" ON "CourseUnit"("classroomId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Concept_classroomId_key_key" ON "Concept"("classroomId", "key");

-- CreateIndex
CREATE INDEX "GenerationJob_classroomId_createdAt_idx" ON "GenerationJob"("classroomId", "createdAt");

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUnit" ADD CONSTRAINT "CourseUnit_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "CourseUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptDependency" ADD CONSTRAINT "ConceptDependency_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptDependency" ADD CONSTRAINT "ConceptDependency_prerequisiteConceptId_fkey" FOREIGN KEY ("prerequisiteConceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
