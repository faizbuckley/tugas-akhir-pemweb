-- CreateEnum
CREATE TYPE "Jenjang" AS ENUM ('D3', 'S1', 'PROFESI', 'S2', 'SPESIALIS', 'S3');

-- DropIndex
DROP INDEX "StudyProgram_facultyId_name_key";

-- AlterTable
ALTER TABLE "Faculty" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "StudyProgram" ADD COLUMN     "level" "Jenjang" NOT NULL DEFAULT 'S1';

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_campusId_code_key" ON "Faculty"("campusId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StudyProgram_facultyId_name_level_key" ON "StudyProgram"("facultyId", "name", "level");

