-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARTICIPANT', 'MENTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "JenisKegiatan" AS ENUM ('LOMBA', 'SEMINAR');

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "Tingkat" AS ENUM ('KAMPUS', 'REGIONAL', 'NASIONAL', 'INTERNASIONAL');

-- CreateEnum
CREATE TYPE "TipePeserta" AS ENUM ('INDIVIDU', 'TIM');

-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('OPEN', 'FULL', 'LOCKED', 'DISBANDED');

-- CreateEnum
CREATE TYPE "MemberOrigin" AS ENUM ('HOST', 'REQUEST', 'INVITE');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'KICKED', 'LEFT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('BOOKED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Campus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "emailDomain" TEXT NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" SERIAL NOT NULL,
    "campusId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyProgram" (
    "id" SERIAL NOT NULL,
    "facultyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "StudyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "campusId" INTEGER,
    "facultyId" INTEGER,
    "studyProgramId" INTEGER,
    "angkatan" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "SkillProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mainRole" TEXT NOT NULL,
    "skills" TEXT[],
    "portfolio" TEXT,
    "history" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KegiatanCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "KegiatanCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kegiatan" (
    "id" TEXT NOT NULL,
    "jenis" "JenisKegiatan" NOT NULL,
    "title" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "registerUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "visibleUntil" TIMESTAMP(3) NOT NULL,
    "categoryId" INTEGER,
    "tingkat" "Tingkat",
    "deadline" TIMESTAMP(3),
    "prize" TEXT,
    "tipePeserta" "TipePeserta",
    "teamSizeMax" INTEGER,
    "speaker" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "kegiatanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","kegiatanId")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "kegiatanId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "slots" INTEGER NOT NULL,
    "rolesNeeded" TEXT[],
    "status" "LobbyStatus" NOT NULL DEFAULT 'OPEN',
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyMember" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" "MemberOrigin" NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
    "role" TEXT,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "whatsapp" TEXT NOT NULL,
    "photoUrl" TEXT,
    "currentStatus" TEXT NOT NULL,
    "jobRole" TEXT,
    "company" TEXT,
    "campusName" TEXT,
    "semester" INTEGER,
    "nim" TEXT,
    "campusEmail" TEXT,
    "field" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "achievements" JSONB NOT NULL,
    "availability" TEXT NOT NULL,
    "meetUrl" TEXT NOT NULL,
    "cvUrl" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "consent" BOOLEAN NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MentorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mentor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expertise" TEXT[],
    "bio" TEXT NOT NULL,
    "meetUrl" TEXT NOT NULL,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Mentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorSlot" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringSession" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "lobbyId" TEXT,
    "subscriptionId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'BOOKED',
    "rating" INTEGER,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoringSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "maxBookmarks" INTEGER,
    "maxActiveLobbies" INTEGER,
    "sessionsPerPeriod" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayRef" TEXT,
    "paymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "transactionId" TEXT,
    "signatureValid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campus_name_key" ON "Campus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_emailDomain_key" ON "Campus"("emailDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_campusId_name_key" ON "Faculty"("campusId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StudyProgram_facultyId_name_key" ON "StudyProgram"("facultyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProfile_userId_key" ON "SkillProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KegiatanCategory_name_key" ON "KegiatanCategory"("name");

-- CreateIndex
CREATE INDEX "Kegiatan_jenis_published_visibleUntil_idx" ON "Kegiatan"("jenis", "published", "visibleUntil");

-- CreateIndex
CREATE INDEX "Kegiatan_categoryId_idx" ON "Kegiatan"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_inviteCode_key" ON "Lobby"("inviteCode");

-- CreateIndex
CREATE INDEX "Lobby_kegiatanId_status_idx" ON "Lobby"("kegiatanId", "status");

-- CreateIndex
CREATE INDEX "Lobby_hostId_idx" ON "Lobby"("hostId");

-- CreateIndex
CREATE INDEX "LobbyMember_userId_status_idx" ON "LobbyMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyMember_lobbyId_userId_key" ON "LobbyMember"("lobbyId", "userId");

-- CreateIndex
CREATE INDEX "MentorApplication_status_idx" ON "MentorApplication"("status");

-- CreateIndex
CREATE INDEX "MentorApplication_email_idx" ON "MentorApplication"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mentor_userId_key" ON "Mentor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorSlot_mentorId_startsAt_key" ON "MentorSlot"("mentorId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "MentoringSession_slotId_key" ON "MentoringSession"("slotId");

-- CreateIndex
CREATE INDEX "MentoringSession_bookedById_idx" ON "MentoringSession"("bookedById");

-- CreateIndex
CREATE INDEX "MentoringSession_subscriptionId_status_idx" ON "MentoringSession"("subscriptionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_transactionId_key" ON "Subscription"("transactionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_endsAt_idx" ON "Subscription"("userId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_orderId_key" ON "Transaction"("orderId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventKey_key" ON "WebhookEvent"("eventKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyProgram" ADD CONSTRAINT "StudyProgram_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_studyProgramId_fkey" FOREIGN KEY ("studyProgramId") REFERENCES "StudyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProfile" ADD CONSTRAINT "SkillProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kegiatan" ADD CONSTRAINT "Kegiatan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KegiatanCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kegiatan" ADD CONSTRAINT "Kegiatan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "Kegiatan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_kegiatanId_fkey" FOREIGN KEY ("kegiatanId") REFERENCES "Kegiatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMember" ADD CONSTRAINT "LobbyMember_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMember" ADD CONSTRAINT "LobbyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorApplication" ADD CONSTRAINT "MentorApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mentor" ADD CONSTRAINT "Mentor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorSlot" ADD CONSTRAINT "MentorSlot_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSession" ADD CONSTRAINT "MentoringSession_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "MentorSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSession" ADD CONSTRAINT "MentoringSession_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSession" ADD CONSTRAINT "MentoringSession_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSession" ADD CONSTRAINT "MentoringSession_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSession" ADD CONSTRAINT "MentoringSession_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
