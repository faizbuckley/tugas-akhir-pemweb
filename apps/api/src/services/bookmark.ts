import { prisma } from "../lib/prisma.js";
import { badRequest, notFound, quotaExceeded } from "../lib/errors.js";
import { getActivePlan } from "./plan.js";
import { listSelect, publicWhere } from "./kegiatan.js";

// Lomba yang ditarik admin (published = false) disembunyikan dan tidak memakan kuota.
// Lomba yang sudah lewat tetap dihitung; pengguna bisa melihat dan menghapusnya.
const visibleBookmarks = (userId: string) => ({ userId, kegiatan: { published: true } });

export const countBookmarks = (userId: string) =>
  prisma.bookmark.count({ where: visibleBookmarks(userId) });

export async function addBookmark(userId: string, kegiatanId: string) {
  const item = await prisma.kegiatan.findFirst({
    where: { id: kegiatanId, ...publicWhere() },
    select: { jenis: true },
  });
  if (!item) throw notFound("Kegiatan tidak ditemukan");
  // Bookmark seminar menunggu keputusan produk (FR-9 hanya menyebut lomba).
  if (item.jenis !== "LOMBA") throw badRequest("Bookmark hanya tersedia untuk lomba");

  return prisma.$transaction(async (tx) => {
    // Kunci baris pengguna supaya permintaan bersamaan antre dan tidak melewati kuota.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const { plan } = await getActivePlan(userId, tx);
    const used = await tx.bookmark.count({ where: visibleBookmarks(userId) });
    const existing = await tx.bookmark.findUnique({
      where: { userId_kegiatanId: { userId, kegiatanId } },
    });
    if (existing) return { created: false, quota: { used, max: plan.maxBookmarks } };

    if (plan.maxBookmarks !== null && used >= plan.maxBookmarks) {
      throw quotaExceeded(
        `Batas ${plan.maxBookmarks} bookmark tercapai. Upgrade ke Pro untuk menambah lebih banyak.`,
      );
    }
    await tx.bookmark.create({ data: { userId, kegiatanId } });
    return { created: true, quota: { used: used + 1, max: plan.maxBookmarks } };
  });
}

export async function removeBookmark(userId: string, kegiatanId: string) {
  await prisma.bookmark.deleteMany({ where: { userId, kegiatanId } });
}

export async function listBookmarks(userId: string, page: number, limit: number) {
  const where = visibleBookmarks(userId);
  const [total, rows, { plan }] = await Promise.all([
    prisma.bookmark.count({ where }),
    prisma.bookmark.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { kegiatanId: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: { createdAt: true, kegiatan: { select: listSelect } },
    }),
    getActivePlan(userId),
  ]);

  const now = new Date();
  return {
    data: rows.map((r) => ({
      ...r.kegiatan,
      bookmarkedAt: r.createdAt,
      expired: r.kegiatan.visibleUntil < now,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      quota: { used: total, max: plan.maxBookmarks },
    },
  };
}
