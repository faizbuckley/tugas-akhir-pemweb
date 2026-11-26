// Aksi pengguna pada lobby. Tiap aksi: kunci baris, periksa aturan, lalu ubah keadaan.
import { randomBytes } from "node:crypto";
import { type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  badRequest, conflict, forbidden, notFound, profileIncomplete, quotaExceeded,
} from "../lib/errors.js";
import { publicWhere } from "./kegiatan.js";
import {
  admit, disband, findBlocker, inTransaction, type LockedLobby, lockLobby, lockUser,
  removeMember,
} from "./lobby-core.js";
import type { CreateLobbyInput } from "../schemas/lobby.js";

type Tx = Prisma.TransactionClient;

const newInviteCode = () => randomBytes(9).toString("base64url");

const memberOf = (lobby: LockedLobby, userId: string) =>
  lobby.members.find((m) => m.userId === userId);

function assertHost(lobby: LockedLobby, userId: string) {
  if (lobby.hostId !== userId) throw forbidden("Hanya host yang bisa melakukan ini");
}

function assertActive(lobby: LockedLobby) {
  if (lobby.status === "LOCKED") throw conflict("Tim sudah terkunci dan tidak bisa diubah");
  if (lobby.status === "DISBANDED") throw conflict("Lobby sudah bubar");
}

// Boleh menambah anggota baru.
function assertOpen(lobby: LockedLobby) {
  assertActive(lobby);
  if (!lobby.kegiatan.published) throw conflict("Lomba sedang tidak tayang");
  if (lobby.status !== "OPEN") throw conflict("Lobby sudah penuh");
}

function pending(lobby: LockedLobby, userId: string, origin: "REQUEST" | "INVITE") {
  const member = memberOf(lobby, userId);
  if (member?.status !== "PENDING" || member.origin !== origin) {
    throw notFound(origin === "REQUEST" ? "Permintaan tidak ditemukan" : "Undangan tidak ditemukan");
  }
  return member;
}

// Nama role dicocokkan tanpa melihat huruf besar kecil, disimpan sesuai tulisan host.
const findRole = (openRoles: string[], role: string) =>
  openRoles.find((r) => r.toLowerCase() === role.toLowerCase());

function requireOpenRole(lobby: LockedLobby, role: string) {
  const match = findRole(lobby.openRoles, role);
  if (!match) throw badRequest("Input tidak valid", { role: "Role ini tidak sedang dicari" });
  return match;
}

// Syarat masuk lobby: peserta dengan role utama terisi (FR-3). Mengembalikan role utama.
async function requireParticipant(tx: Tx, userId: string) {
  const user = await tx.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { roles: { select: { role: true } }, skillProfile: { select: { mainRole: true } } },
  });
  if (!user?.roles.some((r) => r.role === "PARTICIPANT")) {
    throw forbidden("Lobby hanya untuk akun peserta");
  }
  if (!user.skillProfile) throw profileIncomplete("Isi role utama di profil terlebih dahulu");
  return user.skillProfile.mainRole;
}

// Untuk aksi pengguna atas dirinya sendiri.
async function requireRoom(tx: Tx, userId: string, kegiatanId: string) {
  const { blocker, max } = await findBlocker(tx, userId, kegiatanId);
  if (blocker === "same_event") throw conflict("Kamu sudah punya tim untuk lomba ini");
  if (blocker === "quota") {
    throw quotaExceeded(`Batas ${max} lobby aktif tercapai. Upgrade ke Pro untuk menambah.`);
  }
}

export async function createLobby(userId: string, input: CreateLobbyInput) {
  const event = await prisma.kegiatan.findFirst({
    where: { id: input.kegiatanId, ...publicWhere() },
    select: { jenis: true, tipePeserta: true, teamSizeMax: true },
  });
  if (!event) throw notFound("Lomba tidak ditemukan");
  if (event.jenis !== "LOMBA" || event.tipePeserta !== "TIM") {
    throw badRequest("Lobby hanya untuk lomba tim");
  }
  if (input.slots > event.teamSizeMax!) {
    throw badRequest("Input tidak valid", { slots: `Maksimal ${event.teamSizeMax} untuk lomba ini` });
  }
  if (input.rolesNeeded.length !== input.slots - 1) {
    throw badRequest("Input tidak valid", {
      rolesNeeded: `Isi ${input.slots - 1} role (satu per slot selain host)`,
    });
  }

  return inTransaction(async (tx) => {
    await lockUser(tx, userId);
    const mainRole = await requireParticipant(tx, userId);
    await requireRoom(tx, userId, input.kegiatanId);
    const lobby = await tx.lobby.create({
      data: {
        ...input,
        openRoles: input.rolesNeeded,
        hostId: userId,
        inviteCode: newInviteCode(),
        members: {
          create: {
            userId, origin: "HOST", status: "ACCEPTED", role: mainRole, joinedAt: new Date(),
          },
        },
      },
    });
    return lobby.id;
  });
}

export const requestJoin = (lobbyId: string, userId: string, role: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    const current = memberOf(lobby, userId);
    if (current?.status === "ACCEPTED") throw conflict("Kamu sudah anggota lobby ini");
    if (current?.status === "PENDING") {
      throw conflict(
        current.origin === "INVITE"
          ? "Kamu sudah diundang, terima undangannya"
          : "Permintaanmu masih menunggu host",
      );
    }
    assertOpen(lobby);
    await lockUser(tx, userId);
    await requireParticipant(tx, userId);
    const data = {
      origin: "REQUEST" as const,
      status: "PENDING" as const,
      role: requireOpenRole(lobby, role),
      ready: false,
      joinedAt: null,
    };
    await requireRoom(tx, userId, lobby.kegiatanId);
    await tx.lobbyMember.upsert({
      where: { lobbyId_userId: { lobbyId, userId } },
      create: { lobbyId, userId, ...data },
      update: data,
    });
  });

export const acceptRequest = (lobbyId: string, hostId: string, userId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    assertHost(lobby, hostId);
    assertOpen(lobby);
    const member = pending(lobby, userId, "REQUEST");
    if (!findRole(lobby.openRoles, member.role!)) throw conflict(`Role ${member.role} sudah terisi`);
    await lockUser(tx, userId);
    const { blocker } = await findBlocker(tx, userId, lobby.kegiatanId);
    if (blocker === "same_event") throw conflict("Pengguna ini sudah punya tim untuk lomba ini");
    if (blocker === "quota") throw conflict("Pengguna ini sudah mencapai batas lobby aktif");
    await admit(tx, lobby, userId, member.role!);
  });

export const rejectRequest = (lobbyId: string, hostId: string, userId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    assertHost(lobby, hostId);
    const member = pending(lobby, userId, "REQUEST");
    await tx.lobbyMember.update({ where: { id: member.id }, data: { status: "REJECTED" } });
  });

export const invite = (lobbyId: string, hostId: string, userId: string, role: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    assertHost(lobby, hostId);
    assertOpen(lobby);
    const status = memberOf(lobby, userId)?.status;
    if (status === "ACCEPTED") throw conflict("Pengguna ini sudah anggota lobby");
    if (status === "PENDING") throw conflict("Sudah ada undangan atau permintaan yang menunggu");
    await lockUser(tx, userId); // antre bila akunnya sedang dihapus
    const target = await tx.user.findFirst({
      where: { id: userId, deletedAt: null, roles: { some: { role: "PARTICIPANT" } } },
      select: { id: true },
    });
    if (!target) throw notFound("Pengguna tidak ditemukan");
    const data = {
      origin: "INVITE" as const,
      status: "PENDING" as const,
      role: requireOpenRole(lobby, role),
      ready: false,
      joinedAt: null,
    };
    await tx.lobbyMember.upsert({
      where: { lobbyId_userId: { lobbyId, userId } },
      create: { lobbyId, userId, ...data },
      update: data,
    });
  });

export const acceptInvite = (lobbyId: string, userId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    const member = pending(lobby, userId, "INVITE");
    assertOpen(lobby);
    if (!findRole(lobby.openRoles, member.role!)) throw conflict(`Role ${member.role} sudah terisi`);
    await lockUser(tx, userId);
    await requireParticipant(tx, userId);
    await requireRoom(tx, userId, lobby.kegiatanId);
    await admit(tx, lobby, userId, member.role!);
  });

export const rejectInvite = (lobbyId: string, userId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    const member = pending(lobby, userId, "INVITE");
    await tx.lobbyMember.update({ where: { id: member.id }, data: { status: "REJECTED" } });
  });

export const leave = (lobbyId: string, userId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    const member = memberOf(lobby, userId);
    // Peminta yang masih menunggu: "keluar" berarti membatalkan permintaan.
    if (member?.status === "PENDING" && member.origin === "REQUEST") {
      await tx.lobbyMember.update({ where: { id: member.id }, data: { status: "LEFT" } });
      return;
    }
    if (member?.status !== "ACCEPTED") throw notFound("Kamu bukan anggota lobby ini");
    assertActive(lobby);
    await removeMember(tx, lobby, userId, "LEFT");
  });

export const kick = (lobbyId: string, hostId: string, userId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    assertHost(lobby, hostId);
    assertActive(lobby);
    if (userId === hostId) throw conflict("Host tidak bisa mengeluarkan diri sendiri");
    const member = memberOf(lobby, userId);
    if (member?.status === "PENDING" && member.origin === "INVITE") {
      await tx.lobbyMember.update({ where: { id: member.id }, data: { status: "KICKED" } });
      return;
    }
    if (member?.status !== "ACCEPTED") throw notFound("Anggota tidak ditemukan");
    await removeMember(tx, lobby, userId, "KICKED");
  });

export const setReady = (lobbyId: string, userId: string, ready: boolean) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    const member = memberOf(lobby, userId);
    if (member?.status !== "ACCEPTED") throw notFound("Kamu bukan anggota lobby ini");
    assertActive(lobby);
    if (lobby.status !== "FULL") throw conflict("Tombol Siap aktif setelah semua slot terisi");
    await tx.lobbyMember.update({ where: { id: member.id }, data: { ready } });
    const everyone =
      ready &&
      lobby.members.every((m) => m.status !== "ACCEPTED" || m.id === member.id || m.ready);
    if (everyone) {
      await tx.lobby.update({ where: { id: lobbyId }, data: { status: "LOCKED" } });
    }
  });

export const disbandByHost = (lobbyId: string, hostId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    assertHost(lobby, hostId);
    assertActive(lobby);
    await disband(tx, [lobbyId]);
  });

export const regenerateInviteCode = (lobbyId: string, hostId: string) =>
  inTransaction(async (tx) => {
    const lobby = await lockLobby(tx, lobbyId);
    assertHost(lobby, hostId);
    assertActive(lobby);
    await tx.lobby.update({ where: { id: lobbyId }, data: { inviteCode: newInviteCode() } });
  });
