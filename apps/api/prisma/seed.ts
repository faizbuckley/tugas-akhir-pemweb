import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

// Kuota Free. Angka bookmark masih menunggu keputusan PM (PRD v1: 5, tab Deskripsi: 3).
const FREE_MAX_BOOKMARKS = 5;

type Level = "D3" | "S1" | "PROFESI" | "S2" | "SPESIALIS" | "S3";

// Sumber: docs/daftar_fakultas_dan_prodi_upnvj.md
const FACULTIES: { code: string; name: string; programs: [Level, string][] }[] = [
  {
    code: "FEB",
    name: "Fakultas Ekonomi dan Bisnis",
    programs: [
      ["D3", "Perbankan dan Keuangan"],
      ["D3", "Akuntansi"],
      ["S1", "Manajemen"],
      ["S1", "Akuntansi"],
      ["S1", "Ekonomi Pembangunan"],
      ["S1", "Ekonomi Syariah"],
      ["S2", "Manajemen"],
      ["S2", "Akuntansi"],
    ],
  },
  {
    code: "FIK",
    name: "Fakultas Ilmu Komputer",
    programs: [
      ["D3", "Sistem Informasi"],
      ["S1", "Informatika"],
      ["S1", "Sistem Informasi"],
      ["S1", "Sains Data"],
      ["S2", "Sistem Informasi"],
    ],
  },
  {
    code: "FK",
    name: "Fakultas Kedokteran",
    programs: [
      ["S1", "Kedokteran"],
      ["S1", "Farmasi"],
      ["S1", "Biologi"],
      ["PROFESI", "Pendidikan Profesi Dokter"],
      ["S2", "Sains Biomedis"],
      ["SPESIALIS", "Radiologi"],
    ],
  },
  {
    code: "FT",
    name: "Fakultas Teknik",
    programs: [
      ["S1", "Teknik Mesin"],
      ["S1", "Teknik Industri"],
      ["S1", "Teknik Perkapalan"],
      ["S1", "Teknik Elektro"],
      ["S1", "Teknik Logistik"],
    ],
  },
  {
    code: "FISIP",
    name: "Fakultas Ilmu Sosial dan Ilmu Politik",
    programs: [
      ["S1", "Ilmu Komunikasi"],
      ["S1", "Hubungan Internasional"],
      ["S1", "Ilmu Politik"],
      ["S1", "Sains Informasi"],
      ["S1", "Kajian Film, Televisi, dan Media"],
      ["S2", "Ilmu Komunikasi"],
      ["S2", "Hubungan Internasional"],
      ["S2", "Ilmu Politik"],
    ],
  },
  {
    code: "FH",
    name: "Fakultas Hukum",
    programs: [
      ["S1", "Hukum"],
      ["S1", "Hukum Bisnis"],
      ["S2", "Hukum"],
      ["S3", "Hukum"],
    ],
  },
  {
    code: "FIKES",
    name: "Fakultas Ilmu Kesehatan",
    programs: [
      ["D3", "Keperawatan"],
      ["D3", "Fisioterapi"],
      ["S1", "Keperawatan"],
      ["S1", "Kesehatan Masyarakat"],
      ["S1", "Gizi"],
      ["S1", "Fisioterapi"],
      ["PROFESI", "Pendidikan Profesi Ners"],
      ["PROFESI", "Pendidikan Profesi Fisioterapis"],
      ["S2", "Kesehatan Masyarakat"],
      ["S2", "Keperawatan"],
    ],
  },
];

const CATEGORIES = [
  "UI/UX",
  "Programming",
  "Business Plan",
  "Karya Tulis Ilmiah",
  "Desain",
  "Data Science",
];

async function main() {
  // Kampus dan master
  const campus = await prisma.campus.upsert({
    where: { name: "UPN Veteran Jakarta" },
    update: {},
    create: { name: "UPN Veteran Jakarta", emailDomain: "mahasiswa.upnvj.ac.id" },
  });

  for (const f of FACULTIES) {
    const faculty = await prisma.faculty.upsert({
      where: { campusId_name: { campusId: campus.id, name: f.name } },
      update: { code: f.code },
      create: { campusId: campus.id, name: f.name, code: f.code },
    });
    for (const [level, name] of f.programs) {
      await prisma.studyProgram.upsert({
        where: { facultyId_name_level: { facultyId: faculty.id, name, level } },
        update: {},
        create: { facultyId: faculty.id, name, level },
      });
    }
  }

  // Paket
  await prisma.plan.upsert({
    where: { code: "FREE" },
    update: { maxBookmarks: FREE_MAX_BOOKMARKS },
    create: {
      code: "FREE",
      name: "Free",
      price: 0,
      maxBookmarks: FREE_MAX_BOOKMARKS,
      maxActiveLobbies: 1,
      sessionsPerPeriod: 0,
    },
  });
  await prisma.plan.upsert({
    where: { code: "PRO" },
    update: {},
    create: {
      code: "PRO",
      name: "Pro",
      price: 29000,
      durationDays: 30,
      maxBookmarks: null,
      maxActiveLobbies: 5,
      sessionsPerPeriod: 1,
    },
  });

  // Kategori
  const categories: Record<string, number> = {};
  for (const name of CATEGORIES) {
    const c = await prisma.kegiatanCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = c.id;
  }

  // Admin. googleSub sementara "pending:<email>"; diganti saat admin login Google pertama kali.
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) adminEmails.push("admin@example.test");

  let firstAdminId = "";
  for (const email of adminEmails) {
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "Admin", googleSub: `pending:${email}` },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: admin.id, role: Role.ADMIN } },
      update: {},
      create: { userId: admin.id, role: Role.ADMIN },
    });
    if (!firstAdminId) firstAdminId = admin.id;
  }

  // Contoh kegiatan (data uji, bukan data lomba asli)
  const lomba = [
    {
      id: "seed-lomba-uiux",
      title: "Contoh Lomba UI/UX Nasional",
      category: "UI/UX",
      tingkat: "NASIONAL" as const,
      days: 30,
      tipe: "TIM" as const,
      max: 4,
    },
    {
      id: "seed-lomba-hackathon",
      title: "Contoh Hackathon Regional",
      category: "Programming",
      tingkat: "REGIONAL" as const,
      days: 14,
      tipe: "TIM" as const,
      max: 5,
    },
    {
      id: "seed-lomba-kti",
      title: "Contoh Lomba Karya Tulis Ilmiah",
      category: "Karya Tulis Ilmiah",
      tingkat: "KAMPUS" as const,
      days: 21,
      tipe: "INDIVIDU" as const,
      max: 1,
    },
  ];

  for (const l of lomba) {
    const deadline = inDays(l.days);
    const data = {
      jenis: "LOMBA" as const,
      title: l.title,
      organizer: "Penyelenggara Contoh",
      description: "Data contoh untuk pengembangan.",
      mode: "ONLINE" as const,
      fee: 0,
      registerUrl: "https://example.com/daftar",
      published: true,
      visibleUntil: deadline,
      categoryId: categories[l.category],
      tingkat: l.tingkat,
      deadline,
      prize: "Rp5.000.000",
      tipePeserta: l.tipe,
      teamSizeMax: l.max,
      createdById: firstAdminId,
    };
    await prisma.kegiatan.upsert({ where: { id: l.id }, update: data, create: { id: l.id, ...data } });
  }

  const seminarStart = inDays(10);
  const seminar = {
    jenis: "SEMINAR" as const,
    title: "Contoh Seminar Persiapan Lomba",
    organizer: "Penyelenggara Contoh",
    description: "Data contoh untuk pengembangan.",
    mode: "OFFLINE" as const,
    fee: 0,
    registerUrl: "https://example.com/seminar",
    published: true,
    visibleUntil: seminarStart,
    speaker: "Pembicara Contoh",
    location: "Aula UPNVJ",
    startsAt: seminarStart,
    createdById: firstAdminId,
  };
  await prisma.kegiatan.upsert({
    where: { id: "seed-seminar-1" },
    update: seminar,
    create: { id: "seed-seminar-1", ...seminar },
  });

  console.log("Seed selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
