import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Role, type Prisma } from "@prisma/client";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { COOKIE_NAME, signToken } from "../src/lib/jwt.js";

export { prisma };

let server: Server;
let baseUrl = "";

export async function startApi() {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export async function stopApi() {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
}

type Options = {
  cookie?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
};

export async function request(method: string, path: string, opts: Options = {}) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.cookie) headers.cookie = opts.cookie;
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${baseUrl}/api${path}`, { method, headers, body });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function seedBase() {
  const campus = await prisma.campus.create({
    data: { name: "Kampus Test", emailDomain: "mahasiswa.example.test" },
  });
  const fik = await prisma.faculty.create({
    data: {
      campusId: campus.id,
      name: "Fakultas Ilmu Komputer",
      code: "FIK",
      programs: { create: [{ name: "Informatika", level: "S1" }] },
    },
    include: { programs: true },
  });
  const feb = await prisma.faculty.create({
    data: {
      campusId: campus.id,
      name: "Fakultas Ekonomi dan Bisnis",
      code: "FEB",
      programs: { create: [{ name: "Manajemen", level: "S1" }] },
    },
    include: { programs: true },
  });
  const free = await prisma.plan.create({
    data: { code: "FREE", name: "Free", maxBookmarks: 5, maxActiveLobbies: 1 },
  });
  const pro = await prisma.plan.create({
    data: { code: "PRO", name: "Pro", price: 29000, maxActiveLobbies: 5, sessionsPerPeriod: 1 },
  });
  const category = await prisma.kegiatanCategory.create({ data: { name: "Programming" } });
  return { campus, fik, feb, free, pro, category };
}

let sequence = 0;

export async function createUser(data: { campusId?: number; role?: Role; name?: string } = {}) {
  sequence += 1;
  const user = await prisma.user.create({
    data: {
      googleSub: `sub-${sequence}`,
      email: `user${sequence}@mahasiswa.example.test`,
      name: data.name ?? `Pengguna ${sequence}`,
      campusId: data.campusId,
      roles: { create: { role: data.role ?? Role.PARTICIPANT } },
    },
  });
  return { user, cookie: `${COOKIE_NAME}=${signToken(user.id)}` };
}

// Peserta yang profilnya cukup untuk masuk lobby.
export async function createParticipant(
  campusId?: number,
  { mainRole = "Backend", name }: { mainRole?: string; name?: string } = {},
) {
  const account = await createUser({ campusId, name });
  await prisma.skillProfile.create({ data: { userId: account.user.id, mainRole, skills: [] } });
  return account;
}

export type Account = Awaited<ReturnType<typeof createUser>>;

export async function createLomba(
  createdById: string,
  categoryId: number,
  overrides: Partial<Prisma.KegiatanUncheckedCreateInput> = {},
) {
  sequence += 1;
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return prisma.kegiatan.create({
    data: {
      jenis: "LOMBA",
      title: `Lomba ${sequence}`,
      organizer: "Penyelenggara",
      description: "Deskripsi lomba untuk test.",
      mode: "ONLINE",
      registerUrl: "https://example.com/daftar",
      published: true,
      visibleUntil: deadline,
      deadline,
      categoryId,
      tingkat: "NASIONAL",
      tipePeserta: "INDIVIDU",
      createdById,
      ...overrides,
    },
  });
}

export async function subscribePro(userId: string, planId: string, endsInDays = 30) {
  sequence += 1;
  const transaction = await prisma.transaction.create({
    data: { orderId: `order-${sequence}`, userId, planId, amount: 29000, status: "PAID" },
  });
  return prisma.subscription.create({
    data: {
      userId,
      planId,
      transactionId: transaction.id,
      startsAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + endsInDays * 24 * 60 * 60 * 1000),
    },
  });
}
