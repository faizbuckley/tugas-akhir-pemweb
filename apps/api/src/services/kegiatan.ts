import type { Prisma } from "@prisma/client";

// Kolom untuk kartu daftar; dipakai listing publik dan bookmark.
export const listSelect = {
  id: true,
  jenis: true,
  title: true,
  organizer: true,
  mode: true,
  fee: true,
  posterUrl: true,
  visibleUntil: true,
  tingkat: true,
  deadline: true,
  prize: true,
  tipePeserta: true,
  teamSizeMax: true,
  startsAt: true,
  location: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.KegiatanSelect;

// Satu-satunya definisi "tayang di publik": sudah dipublikasikan dan belum lewat waktu.
export const publicWhere = (): Prisma.KegiatanWhereInput => ({
  published: true,
  visibleUntil: { gte: new Date() },
});
