import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import { listQuery } from "../schemas/kegiatan.js";
import { requireAuth } from "../middleware/auth.js";
import { listSelect, publicWhere } from "../services/kegiatan.js";
import { addBookmark, removeBookmark } from "../services/bookmark.js";

export const kegiatanRouter = Router();
export const categoryRouter = Router();

kegiatanRouter.get("/", async (req, res) => {
  const q = listQuery.parse(req.query);

  const where: Prisma.KegiatanWhereInput = {
    ...publicWhere(),
    jenis: q.jenis,
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.tingkat && { tingkat: q.tingkat }),
    ...(q.mode && { mode: q.mode }),
    ...(q.tipePeserta && { tipePeserta: q.tipePeserta }),
    ...(q.fee === "free" && { fee: 0 }),
    ...(q.fee === "paid" && { fee: { gt: 0 } }),
    ...(q.q && {
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { organizer: { contains: q.q, mode: "insensitive" } },
      ],
    }),
  };
  if (q.deadlineBefore) {
    where.visibleUntil = { gte: new Date(), lte: q.deadlineBefore };
  }

  const orderBy: Prisma.KegiatanOrderByWithRelationInput[] =
    q.sort === "newest"
      ? [{ createdAt: "desc" }, { id: "asc" }]
      : [{ visibleUntil: "asc" }, { id: "asc" }];

  const [total, data] = await Promise.all([
    prisma.kegiatan.count({ where }),
    prisma.kegiatan.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: listSelect,
    }),
  ]);

  res.json({
    data,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  });
});

kegiatanRouter.get("/:id", async (req, res) => {
  const item = await prisma.kegiatan.findFirst({
    where: { id: req.params.id, ...publicWhere() },
    select: {
      ...listSelect,
      description: true,
      registerUrl: true,
      speaker: true,
      createdAt: true,
    },
  });
  if (!item) throw notFound("Kegiatan tidak ditemukan");

  // Lobby terbuka hanya relevan untuk lomba tim (FR-8).
  const lobbies =
    item.jenis === "LOMBA" && item.tipePeserta === "TIM"
      ? await prisma.lobby
          .findMany({
            where: { kegiatanId: item.id, status: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              teamName: true,
              slots: true,
              rolesNeeded: true,
              host: { select: { id: true, name: true, avatarUrl: true } },
              _count: { select: { members: { where: { status: "ACCEPTED" } } } },
            },
          })
          .then((rows) =>
            rows.map(({ _count, ...l }) => ({ ...l, filledSlots: _count.members })),
          )
      : [];

  res.json({ data: { ...item, lobbies } });
});

kegiatanRouter.post("/:id/bookmark", requireAuth, async (req, res) => {
  const kegiatanId = String(req.params.id);
  const { created, quota } = await addBookmark(req.user!.id, kegiatanId);
  res.status(created ? 201 : 200).json({ data: { kegiatanId, quota } });
});

kegiatanRouter.delete("/:id/bookmark", requireAuth, async (req, res) => {
  await removeBookmark(req.user!.id, String(req.params.id));
  res.status(204).end();
});

categoryRouter.get("/", async (_req, res) => {
  const data = await prisma.kegiatanCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  res.json({ data });
});
