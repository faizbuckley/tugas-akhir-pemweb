import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound, zodFields } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  adminListQuery,
  kegiatanInput,
  pickEditable,
  publishInput,
  toDbData,
} from "../schemas/kegiatan.js";

export const adminKegiatanRouter = Router();

adminKegiatanRouter.use(requireAuth, requireRole("ADMIN"));

adminKegiatanRouter.get("/", async (req, res) => {
  const q = adminListQuery.parse(req.query);
  const where: Prisma.KegiatanWhereInput = {
    ...(q.jenis && { jenis: q.jenis }),
    ...(q.published && { published: q.published === "true" }),
    ...(q.q && {
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { organizer: { contains: q.q, mode: "insensitive" } },
      ],
    }),
  };
  const [total, data] = await Promise.all([
    prisma.kegiatan.count({ where }),
    prisma.kegiatan.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { category: { select: { id: true, name: true } }, _count: { select: { lobbies: true } } },
    }),
  ]);
  res.json({
    data,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  });
});

adminKegiatanRouter.get("/:id", async (req, res) => {
  const item = await prisma.kegiatan.findUnique({
    where: { id: req.params.id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!item) throw notFound();
  res.json({ data: item });
});

async function assertCategoryExists(categoryId: number | null) {
  if (categoryId == null) return;
  const exists = await prisma.kegiatanCategory.findUnique({ where: { id: categoryId } });
  if (!exists) throw badRequest("Kategori tidak ditemukan", { categoryId: "Kategori tidak ditemukan" });
}

adminKegiatanRouter.post("/", async (req, res) => {
  const input = kegiatanInput.parse(req.body);
  const data = toDbData(input);

  if (data.visibleUntil.getTime() <= Date.now()) {
    const field = input.jenis === "LOMBA" ? "deadline" : "startsAt";
    throw badRequest("Tanggal harus di masa depan", { [field]: "Harus di masa depan" });
  }
  await assertCategoryExists(data.categoryId);

  const created = await prisma.kegiatan.create({
    data: { ...data, published: false, createdById: req.user!.id },
  });
  res.status(201).json({ data: created });
});

adminKegiatanRouter.patch("/:id", async (req, res) => {
  const existing = await prisma.kegiatan.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound();

  if (req.body?.jenis && req.body.jenis !== existing.jenis) {
    throw badRequest("Jenis kegiatan tidak bisa diubah", { jenis: "Tidak bisa diubah" });
  }

  // Gabungkan record lama dengan perubahan, lalu validasi ulang secara utuh.
  const merged = { ...pickEditable(existing), ...req.body, jenis: existing.jenis };
  const input = kegiatanInput.parse(merged);
  const data = toDbData(input);
  await assertCategoryExists(data.categoryId);

  const updated = await prisma.kegiatan.update({ where: { id: existing.id }, data });
  res.json({ data: updated });
});

adminKegiatanRouter.post("/:id/publish", async (req, res) => {
  const parsed = publishInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Input tidak valid", zodFields(parsed.error));

  const existing = await prisma.kegiatan.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound();

  if (parsed.data.published && existing.visibleUntil.getTime() <= Date.now()) {
    throw conflict("Kegiatan sudah lewat waktu, ubah tanggalnya sebelum dipublikasikan");
  }

  const updated = await prisma.kegiatan.update({
    where: { id: existing.id },
    data: { published: parsed.data.published },
  });
  res.json({ data: updated });
});

adminKegiatanRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.kegiatan.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { lobbies: true } } },
  });
  if (!existing) throw notFound();
  if (existing._count.lobbies > 0) {
    throw conflict("Kegiatan sudah punya lobby, batalkan publikasi saja");
  }
  await prisma.kegiatan.delete({ where: { id: existing.id } });
  res.status(204).end();
});
