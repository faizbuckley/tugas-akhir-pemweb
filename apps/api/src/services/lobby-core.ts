// Aturan dan perubahan keadaan lobby (lihat docs/lobby.md). Semua fungsi bertipe `tx`
// harus dipanggil di dalam transaksi setelah baris yang relevan dikunci.
import { type LobbyStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import { getActivePlan } from "./plan.js";

type Tx = Prisma.TransactionClient;

export const ACTIVE: LobbyStatus[] = ["OPEN", "FULL"];

// Waktu tunggu dilonggarkan karena permintaan ke lobby yang sama antre pada kunci baris.
export const inTransaction = <T>(fn: (tx: Tx) => Promise<T>) =>
  prisma.$transaction(fn, { maxWait: 10_000, timeout: 10_000 });

// Urutan kunci selalu lobby dulu, baru pengguna (cegah deadlock).
export async function lockLobby(tx: Tx, lobbyId: string) {
  await tx.$queryRaw`SELECT id FROM "Lobby" WHERE id = ${lobbyId} FOR UPDATE`;
  const lobby = await tx.lobby.findUnique({
    where: { id: lobbyId },
    include: { members: true, kegiatan: { select: { published: true } } },
  });
  if (!lobby) throw notFound("Lobby tidak ditemukan");
  return lobby;
}
export type LockedLobby = Awaited<ReturnType<typeof lockLobby>>;

// NO KEY UPDATE: cukup untuk antre kuota, tanpa menghalangi baris lain yang merujuk pengguna.
export const lockUser = (tx: Tx, userId: string) =>
  tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR NO KEY UPDATE`;

export type Blocker = "same_event" | "quota" | null;

// Bolehkah pengguna menempati satu lobby lagi untuk lomba ini?
export async function findBlocker(tx: Tx, userId: string, kegiatanId: string) {
  const sameEvent = await tx.lobbyMember.count({
    where: {
      userId,
      status: "ACCEPTED",
      lobby: { kegiatanId, status: { in: [...ACTIVE, "LOCKED"] } },
    },
  });
  const { plan } = await getActivePlan(userId, tx);
  const active = await tx.lobbyMember.count({
    where: {
      userId,
      status: "ACCEPTED",
      lobby: { status: { in: ACTIVE }, kegiatan: { deadline: { gte: new Date() } } },
    },
  });
  const full = plan.maxActiveLobbies !== null && active >= plan.maxActiveLobbies;
  const blocker: Blocker = sameEvent > 0 ? "same_event" : full ? "quota" : null;
  return { blocker, max: plan.maxActiveLobbies };
}

export async function disband(tx: Tx, lobbyIds: string[]) {
  await tx.lobbyMember.updateMany({
    where: { lobbyId: { in: lobbyIds }, status: "PENDING" },
    data: { status: "REJECTED" },
  });
  await tx.lobbyMember.updateMany({
    where: { lobbyId: { in: lobbyIds } },
    data: { ready: false },
  });
  await tx.lobby.updateMany({
    where: { id: { in: lobbyIds }, status: { in: ACTIVE } },
    data: { status: "DISBANDED" },
  });
}

// FR-19: lobby yang lombanya lewat deadline otomatis bubar. Dijalankan saat ada permintaan (tanpa cron).
export async function expireLobbies() {
  const where = () => ({
    status: { in: ACTIVE },
    kegiatan: { deadline: { lt: new Date() } },
  });
  const stale = await prisma.lobby.findMany({
    where: where(),
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (stale.length === 0) return;
  await inTransaction(async (tx) => {
    // Kunci seperti aksi lain, lalu baca ulang: bisa saja baru saja terkunci atau sudah bubar.
    for (const { id } of stale) await lockLobby(tx, id);
    const still = await tx.lobby.findMany({ where: where(), select: { id: true } });
    await disband(tx, still.map((l) => l.id));
  });
}

function without(list: string[], value: string) {
  const index = list.indexOf(value);
  return list.filter((_, i) => i !== index);
}

// Menempatkan anggota yang menunggu ke slot role-nya. Slot habis: FULL, sisanya ditolak (FR-15).
export async function admit(tx: Tx, lobby: LockedLobby, userId: string, role: string) {
  const openRoles = without(lobby.openRoles, role);
  await tx.lobbyMember.update({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId } },
    data: { status: "ACCEPTED", ready: false, joinedAt: new Date() },
  });
  const full = openRoles.length === 0;
  if (full) {
    await tx.lobbyMember.updateMany({
      where: { lobbyId: lobby.id, status: "PENDING" },
      data: { status: "REJECTED" },
    });
  }
  await tx.lobby.update({
    where: { id: lobby.id },
    data: { openRoles, status: full ? "FULL" : "OPEN" },
  });
}

// Anggota keluar atau di-kick (FR-17). Bila host yang keluar, status host pindah ke anggota terlama.
export async function removeMember(
  tx: Tx,
  lobby: LockedLobby,
  userId: string,
  status: "LEFT" | "KICKED",
) {
  const accepted = lobby.members.filter((m) => m.status === "ACCEPTED");
  const leaving = accepted.find((m) => m.userId === userId)!;
  const remaining = accepted
    .filter((m) => m.userId !== userId)
    .sort((a, b) => a.joinedAt!.getTime() - b.joinedAt!.getTime());

  await tx.lobbyMember.update({ where: { id: leaving.id }, data: { status, ready: false } });

  const isHost = lobby.hostId === userId;
  if (isHost && remaining.length === 0) {
    await disband(tx, [lobby.id]);
    return;
  }

  const successor = isHost ? remaining[0] : null;
  await tx.lobbyMember.updateMany({ where: { lobbyId: lobby.id }, data: { ready: false } });
  await tx.lobby.update({
    where: { id: lobby.id },
    data: {
      status: "OPEN",
      openRoles: [...lobby.openRoles, leaving.role!],
      // rolesNeeded = role semua slot selain host, jadi ikut berubah saat host berganti.
      ...(successor && {
        hostId: successor.userId,
        rolesNeeded: [...without(lobby.rolesNeeded, successor.role!), leaving.role!],
      }),
    },
  });
}

// Dipakai saat akun dihapus: batalkan yang menunggu dan keluar dari semua lobby aktif.
export async function leaveAllLobbies(tx: Tx, userId: string) {
  const joined: Prisma.LobbyWhereInput = {
    status: { in: ACTIVE },
    members: { some: { userId, status: "ACCEPTED" } },
  };
  const waiting: Prisma.LobbyWhereInput = { members: { some: { userId, status: "PENDING" } } };
  const ids = async (where: Prisma.LobbyWhereInput) =>
    (await tx.lobby.findMany({ where, select: { id: true }, orderBy: { id: "asc" } })).map(
      (l) => l.id,
    );

  // Lobby yang masih menunggu ikut dikunci, supaya penerimaan tidak menyelip di tengah jalan.
  for (const id of await ids({ OR: [joined, waiting] })) await lockLobby(tx, id);
  await lockUser(tx, userId);

  // Dibaca ulang setelah pengguna terkunci: penerimaan yang baru saja selesai ikut ditangani.
  for (const id of await ids(joined)) {
    await removeMember(tx, await lockLobby(tx, id), userId, "LEFT");
  }
  await tx.lobbyMember.updateMany({
    where: { userId, status: "PENDING" },
    data: { status: "LEFT" },
  });
}
