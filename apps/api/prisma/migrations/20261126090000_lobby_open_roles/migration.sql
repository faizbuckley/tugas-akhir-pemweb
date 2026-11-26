-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "openRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "LobbyMember" ADD COLUMN     "joinedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lobby_openRoles_idx" ON "Lobby" USING GIN ("openRoles");

