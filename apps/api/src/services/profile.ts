import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/errors.js";
import { getActivePlan } from "./plan.js";
import { countBookmarks } from "./bookmark.js";
import type { ProfileInput } from "../schemas/profile.js";

const profileSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  angkatan: true,
  campus: { select: { id: true, name: true } },
  faculty: { select: { id: true, name: true, code: true } },
  studyProgram: { select: { id: true, name: true, level: true } },
  skillProfile: {
    select: { mainRole: true, skills: true, portfolio: true, history: true, updatedAt: true },
  },
} as const;

// Data akun sendiri: profil + email, peran, dan paket aktif.
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...profileSelect, email: true, roles: { select: { role: true } } },
  });
  if (!user) throw notFound();

  const { plan, endsAt } = await getActivePlan(userId);
  return {
    ...user,
    usage: { bookmarks: await countBookmarks(userId) },
    roles: user.roles.map((r) => r.role),
    profileComplete: Boolean(user.skillProfile?.mainRole),
    plan: {
      code: plan.code,
      name: plan.name,
      maxBookmarks: plan.maxBookmarks,
      maxActiveLobbies: plan.maxActiveLobbies,
      sessionsPerPeriod: plan.sessionsPerPeriod,
      endsAt,
    },
  };
}

// Profil yang boleh dilihat pengguna lain: tanpa email dan id Google.
export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: profileSelect,
  });
  if (!user) throw notFound("Pengguna tidak ditemukan");
  return user;
}

// Menentukan pasangan fakultas dan prodi yang konsisten dari input sebagian.
async function resolveAcademic(
  current: { campusId: number | null; facultyId: number | null; studyProgramId: number | null },
  input: ProfileInput,
) {
  let { facultyId, studyProgramId } = current;

  if (input.facultyId !== undefined) facultyId = input.facultyId;

  if (input.studyProgramId !== undefined) {
    studyProgramId = input.studyProgramId;
    if (studyProgramId !== null) {
      const program = await prisma.studyProgram.findUnique({ where: { id: studyProgramId } });
      const mismatch = input.facultyId !== undefined && input.facultyId !== program?.facultyId;
      if (!program || mismatch) {
        throw badRequest("Input tidak valid", {
          studyProgramId: "Prodi tidak ada di fakultas tersebut",
        });
      }
      facultyId = program.facultyId;
    }
  } else if (studyProgramId !== null && facultyId !== current.facultyId) {
    studyProgramId = null; // prodi lama bukan bagian dari fakultas baru
  }

  const changed = facultyId !== current.facultyId;
  if (changed && facultyId !== null) {
    const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    if (!faculty || (current.campusId !== null && faculty.campusId !== current.campusId)) {
      const field = input.facultyId !== undefined ? "facultyId" : "studyProgramId";
      throw badRequest("Input tidak valid", { [field]: "Tidak tersedia di kampusmu" });
    }
  }

  return { facultyId, studyProgramId };
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      campusId: true,
      facultyId: true,
      studyProgramId: true,
      skillProfile: { select: { id: true } },
    },
  });

  const { mainRole, skills, portfolio, history, angkatan } = input;
  const touchesSkill = [mainRole, skills, portfolio, history].some((v) => v !== undefined);
  if (touchesSkill && !user.skillProfile && !mainRole) {
    throw badRequest("Input tidak valid", { mainRole: "Role utama wajib diisi" });
  }

  const academic = await resolveAcademic(user, input);

  // Bukan upsert: Prisma tetap memvalidasi bagian create, padahal saat update mainRole boleh kosong.
  const skillWrite = user.skillProfile
    ? { update: { mainRole, skills, portfolio, history } }
    : { create: { mainRole: mainRole!, skills: skills ?? [], portfolio, history } };

  await prisma.user.update({
    where: { id: userId },
    data: { ...academic, angkatan, ...(touchesSkill && { skillProfile: skillWrite }) },
  });
}
