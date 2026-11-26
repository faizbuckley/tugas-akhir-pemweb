import assert from "node:assert/strict";
import {
  type Account, createLomba, createParticipant, prisma, request, resetDb, seedBase,
} from "./helpers.js";

export const ROLES = ["Frontend", "UI/UX", "Data"];
export const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

// Keadaan awal yang dipakai semua test lobby: satu lomba tim (maks. 4) dan seorang host.
export async function lobbyWorld() {
  await resetDb();
  const base = await seedBase();
  const host = await createParticipant(base.campus.id, { name: "Host" });
  const lomba = (overrides = {}) =>
    createLomba(host.user.id, base.category.id, {
      tipePeserta: "TIM",
      teamSizeMax: 4,
      ...overrides,
    });
  const event = await lomba();
  const person = (name?: string) => createParticipant(base.campus.id, { name });
  return { base, host, event, lomba, person };
}

export const act = (who: Account, path: string, body?: unknown) =>
  request("POST", `/lobbies${path}`, { cookie: who.cookie, body });

export const view = (who: Account, id: string) =>
  request("GET", `/lobbies/${id}`, { cookie: who.cookie });

export const openLobby = (
  who: Account,
  kegiatanId: string,
  { slots = 3, rolesNeeded = ROLES.slice(0, slots - 1), teamName = "Tim Garuda" } = {},
) => act(who, "", { kegiatanId, teamName, slots, rolesNeeded });

export async function createdLobby(...args: Parameters<typeof openLobby>) {
  const res = await openLobby(...args);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data as { id: string; inviteCode: string };
}

// Permintaan gabung yang langsung diterima host.
export async function join(host: Account, who: Account, lobbyId: string, role: string) {
  const asked = await act(who, `/${lobbyId}/join-requests`, { role });
  assert.equal(asked.status, 201, JSON.stringify(asked.body));
  const accepted = await act(host, `/${lobbyId}/join-requests/${who.user.id}/accept`);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
}

export const lobbyRow = (id: string) =>
  prisma.lobby.findUniqueOrThrow({ where: { id }, include: { members: true } });

export const memberStatus = async (lobbyId: string, userId: string) =>
  (await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } }))?.status;
