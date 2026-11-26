import { inTransaction, leaveAllLobbies } from "./lobby-core.js";

/**
 * Hapus akun (FR-46): baris User dipertahankan dan dianonimkan, supaya transaksi tetap utuh.
 * googleSub dan email dilepas, jadi login ulang membuat akun baru yang kosong.
 *
 * Pengguna dikeluarkan dari lobby aktif; tim yang sudah terkunci tetap tercatat.
 *
 * TODO modul mentoring: batalkan sesi yang masih BOOKED (endpoint sesi belum ada).
 */
export async function deleteAccount(userId: string) {
  await inTransaction(async (tx) => {
    await leaveAllLobbies(tx, userId);
    const { email } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    // Pengajuan mentor berisi data pribadi, dan yang APPROVED akan membuat akun lagi saat login.
    await tx.mentorApplication.deleteMany({ where: { OR: [{ userId }, { email }] } });
    await tx.mentor.updateMany({
      where: { userId },
      data: { active: false, bio: "", meetUrl: "" },
    });

    await tx.skillProfile.deleteMany({ where: { userId } });
    await tx.bookmark.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.userRole.deleteMany({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        name: "Pengguna dihapus",
        email: `deleted+${userId}@deleted.invalid`,
        googleSub: `deleted:${userId}`,
        avatarUrl: null,
        campusId: null,
        facultyId: null,
        studyProgramId: null,
        angkatan: null,
      },
    });
  });
}
