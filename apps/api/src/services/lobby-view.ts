// Bentuk data lobby yang dikirim ke FE. Email tidak pernah ikut.
import { type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import type { BrowseQuery } from "../schemas/lobby.js";

const person = {
  id: true,
  name: true,
  avatarUrl: true,
  faculty: { select: { id: true, name: true, code: true } },
  studyProgram: { select: { id: true, name: true, level: true } },
} satisfies Prisma.UserSelect;

const cardSelect = {
  id: true,
  teamName: true,
  status: true,
  slots: true,
  openRoles: true,
  createdAt: true,
  kegiatan: { select: { id: true, title: true, deadline: true } },
  host: { select: person },
  _count: { select: { members: { where: { status: "ACCEPTED" } } } },
} satisfies Prisma.LobbySelect;

function toCard({ _count, ...lobby }: Prisma.LobbyGetPayload<{ select: typeof cardSelect }>) {
  return { ...lobby, filledSlots: _count.members };
}

const pageMeta = (page: number, limit: number, total: number) => ({
  page, limit, total, totalPages: Math.ceil(total / limit),
});

export async function browseLobbies(q: BrowseQuery) {
  const where: Prisma.LobbyWhereInput = {
    status: "OPEN",
    kegiatan: { published: true, deadline: { gte: new Date() } },
    ...(q.kegiatanId && { kegiatanId: q.kegiatanId }),
    ...(q.role && { openRoles: { has: q.role } }),
    // FR-48: fakultas dan prodi mengacu pada host.
    ...((q.facultyId || q.studyProgramId) && {
      host: { facultyId: q.facultyId, studyProgramId: q.studyProgramId },
    }),
  };
  const [total, rows] = await Promise.all([
    prisma.lobby.count({ where }),
    prisma.lobby.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: cardSelect,
    }),
  ]);
  return { data: rows.map(toCard), meta: pageMeta(q.page, q.limit, total) };
}

export async function myLobbies(userId: string, page: number, limit: number) {
  const where: Prisma.LobbyWhereInput = {
    members: { some: { userId, status: { in: ["ACCEPTED", "PENDING"] } } },
  };
  const [total, rows] = await Promise.all([
    prisma.lobby.count({ where }),
    prisma.lobby.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        ...cardSelect,
        hostId: true,
        members: { where: { userId }, select: { status: true, origin: true, role: true } },
      },
    }),
  ]);
  const data = rows.map(({ members, hostId, ...row }) => ({
    ...toCard(row),
    me: { isHost: hostId === userId, ...members[0] },
  }));
  return { data, meta: pageMeta(page, limit, total) };
}

// Pratinjau untuk tautan undangan: tanpa login, tanpa data anggota.
export async function previewByCode(inviteCode: string) {
  const lobby = await prisma.lobby.findFirst({
    where: { inviteCode, kegiatan: { published: true } },
    select: cardSelect,
  });
  if (!lobby) throw notFound("Tautan undangan tidak berlaku");
  const { id, teamName, status, slots, openRoles, kegiatan, filledSlots } = toCard(lobby);
  return { id, teamName, status, slots, filledSlots, openRoles, kegiatan };
}

// Detail ruang lobby (dipakai polling). Kode undangan dan daftar menunggu hanya untuk host.
export async function lobbyDetail(lobbyId: string, viewerId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    select: {
      id: true,
      teamName: true,
      status: true,
      slots: true,
      rolesNeeded: true,
      openRoles: true,
      hostId: true,
      inviteCode: true,
      createdAt: true,
      updatedAt: true,
      kegiatan: { select: { id: true, title: true, deadline: true } },
      members: {
        orderBy: [{ joinedAt: "asc" }, { createdAt: "asc" }],
        select: {
          status: true, origin: true, role: true, ready: true, user: { select: person },
        },
      },
    },
  });
  if (!lobby) throw notFound("Lobby tidak ditemukan");

  const { members, inviteCode, ...rest } = lobby;
  const isHost = lobby.hostId === viewerId;
  const mine = members.find((m) => m.user.id === viewerId);
  const accepted = members.filter((m) => m.status === "ACCEPTED");
  const profile = ({ id, ...user }: (typeof members)[number]["user"]) => ({ userId: id, ...user });

  return {
    ...rest,
    filledSlots: accepted.length,
    members: accepted.map((m) => ({
      ...profile(m.user),
      role: m.role,
      ready: m.ready,
      isHost: m.user.id === lobby.hostId,
    })),
    me: mine ? { isHost, status: mine.status, origin: mine.origin, role: mine.role } : null,
    ...(isHost && {
      inviteCode,
      pending: members
        .filter((m) => m.status === "PENDING")
        .map((m) => ({ ...profile(m.user), role: m.role, origin: m.origin })),
    }),
  };
}
