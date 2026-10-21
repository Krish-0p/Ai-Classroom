CREATE TABLE "SlideDeck" (
    "classroomId" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "curriculumVersion" INTEGER NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "published" JSONB,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedCurriculumVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SlideDeck_pkey" PRIMARY KEY ("classroomId")
);

ALTER TABLE "SlideDeck" ADD CONSTRAINT "SlideDeck_classroomId_fkey"
    FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
