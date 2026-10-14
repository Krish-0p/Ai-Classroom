ALTER TABLE "Curriculum" ADD COLUMN "approvedSourceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Curriculum" SET "approvedSourceIds" = COALESCE("sourceIds", ARRAY[]::TEXT[]) WHERE "approvedVersion" = "draftVersion" AND "approved" IS NOT NULL;
ALTER TABLE "GenerationJob" ADD COLUMN "inputHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GenerationJob" ADD COLUMN "lessonId" TEXT;

CREATE TYPE "LessonStatus" AS ENUM ('draft', 'review', 'published', 'archived');
CREATE TABLE "Lesson" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL DEFAULT 15,
  "status" "LessonStatus" NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "published" JSONB,
  "publishedVersion" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LessonBlock" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LessonBlock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lesson_classroomId_status_idx" ON "Lesson"("classroomId", "status");
CREATE INDEX "Lesson_conceptId_idx" ON "Lesson"("conceptId");
CREATE UNIQUE INDEX "LessonBlock_lessonId_key_key" ON "LessonBlock"("lessonId", "key");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "CourseUnit"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LessonBlock" ADD CONSTRAINT "LessonBlock_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
