import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createLomba, createUser, prisma, request, resetDb, seedBase, startApi, stopApi, subscribePro,
} from "./helpers.js";

let base: Awaited<ReturnType<typeof seedBase>>;

before(startApi);
after(stopApi);
beforeEach(async () => {
  await resetDb();
  base = await seedBase();
});

describe("DELETE /me", () => {
  test("ditolak tanpa login", async () => {
    const res = await request("DELETE", "/me");
    assert.equal(res.status, 401);
  });

  test("menghapus sesi dan mematikan token lama", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await request("DELETE", "/me", { cookie });

    assert.equal(res.status, 204);
    assert.match(res.headers.get("set-cookie") ?? "", /va_token=;/);
    assert.equal((await request("GET", "/me", { cookie })).status, 401);
  });

  test("mengosongkan data pribadi tetapi barisnya tetap ada", async () => {
    const { cookie, user } = await createUser({ campusId: base.campus.id, name: "Dina" });
    await request("PATCH", "/me/profile", {
      cookie,
      body: { mainRole: "Backend", studyProgramId: base.fik.programs[0].id, angkatan: 2024 },
    });
    const lomba = await createLomba(user.id, base.category.id);
    await prisma.bookmark.create({ data: { userId: user.id, kegiatanId: lomba.id } });

    await request("DELETE", "/me", { cookie });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { skillProfile: true, bookmarks: true, roles: true },
    });
    assert.ok(row.deletedAt);
    assert.notEqual(row.name, "Dina");
    assert.notEqual(row.email, user.email);
    assert.notEqual(row.googleSub, user.googleSub);
    assert.equal(row.avatarUrl, null);
    assert.equal(row.facultyId, null);
    assert.equal(row.studyProgramId, null);
    assert.equal(row.angkatan, null);
    assert.equal(row.skillProfile, null);
    assert.deepEqual(row.bookmarks, []);
    assert.deepEqual(row.roles, []);
  });

  test("transaksi dan langganan tetap utuh", async () => {
    const { cookie, user } = await createUser();
    await subscribePro(user.id, base.pro.id);

    await request("DELETE", "/me", { cookie });

    assert.equal(await prisma.transaction.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.subscription.count({ where: { userId: user.id } }), 1);
  });

  test("mentor dinonaktifkan dan pengajuannya dihapus agar akun tidak dibuat ulang otomatis", async () => {
    const { cookie, user } = await createUser({ role: "MENTOR" });
    await prisma.mentor.create({
      data: { userId: user.id, expertise: ["Backend"], bio: "Bio", meetUrl: "https://meet.example.com/a" },
    });
    await prisma.mentorApplication.create({
      data: {
        email: user.email,
        fullName: user.name,
        whatsapp: "0800000000",
        currentStatus: "BEKERJA",
        field: "Backend",
        motivation: "Berbagi",
        achievements: [],
        availability: "Akhir pekan",
        meetUrl: "https://meet.example.com/a",
        cvUrl: "https://example.com/cv.pdf",
        consent: true,
        status: "APPROVED",
      },
    });

    await request("DELETE", "/me", { cookie });

    const mentor = await prisma.mentor.findUniqueOrThrow({ where: { userId: user.id } });
    assert.equal(mentor.active, false);
    assert.equal(mentor.bio, "");
    assert.equal(mentor.meetUrl, "");
    assert.equal(await prisma.mentorApplication.count(), 0);
  });
});
