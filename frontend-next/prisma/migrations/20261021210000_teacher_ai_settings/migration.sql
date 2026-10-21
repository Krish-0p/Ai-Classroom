CREATE TABLE "TeacherAISettings" (
    "teacherId" TEXT NOT NULL,
    "encryptedGroqKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAISettings_pkey" PRIMARY KEY ("teacherId")
);

ALTER TABLE "TeacherAISettings" ADD CONSTRAINT "TeacherAISettings_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
