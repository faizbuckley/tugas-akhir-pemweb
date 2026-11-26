import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createUser, prisma, request, resetDb, seedBase, startApi, stopApi,
} from "./helpers.js";

let base: Awaited<ReturnType<typeof seedBase>>;

before(startApi);
after(stopApi);
beforeEach(async () => {
  await resetDb();
  base = await seedBase();
});

const patch = (cookie: string, body: unknown) => request("PATCH", "/me/profile", { cookie, body });

describe("PATCH /me/profile", () => {
  test("ditolak tanpa login", async () => {
    const res = await request("PATCH", "/me/profile", { body: { mainRole: "Backend" } });
    assert.equal(res.status, 401);
  });

  test("menyimpan profil lengkap dan mengembalikan data /me terbaru", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, {
      facultyId: base.fik.id,
      studyProgramId: base.fik.programs[0].id,
      angkatan: 2024,
      mainRole: "Backend",
      skills: ["Node.js", "PostgreSQL"],
      portfolio: "https://example.com/porto",
      history: "Juara 2 hackathon kampus",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.faculty.code, "FIK");
    assert.equal(res.body.data.studyProgram.name, "Informatika");
    assert.equal(res.body.data.angkatan, 2024);
    assert.equal(res.body.data.skillProfile.mainRole, "Backend");
    assert.deepEqual(res.body.data.skillProfile.skills, ["Node.js", "PostgreSQL"]);
    assert.equal(res.body.data.profileComplete, true);
  });

  test("hanya mengubah kolom yang dikirim", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    await patch(cookie, { mainRole: "Backend", skills: ["Go"], angkatan: 2023 });
    const res = await patch(cookie, { history: "Finalis" });

    assert.equal(res.body.data.skillProfile.mainRole, "Backend");
    assert.deepEqual(res.body.data.skillProfile.skills, ["Go"]);
    assert.equal(res.body.data.angkatan, 2023);
    assert.equal(res.body.data.skillProfile.history, "Finalis");
  });

  test("role utama wajib saat profil skill pertama kali dibuat", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, { skills: ["Figma"] });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.mainRole);
    assert.equal(await prisma.skillProfile.count(), 0);
  });

  test("data akademik boleh diisi tanpa role utama", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, { angkatan: 2024 });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.profileComplete, false);
  });

  test("skill kembar (beda huruf besar kecil) disimpan sekali", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, { mainRole: "UI/UX", skills: ["Figma", " figma ", "Riset"] });

    assert.deepEqual(res.body.data.skillProfile.skills, ["Figma", "Riset"]);
  });

  test("fakultas diisi otomatis dari prodi", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, { studyProgramId: base.feb.programs[0].id });

    assert.equal(res.body.data.faculty.code, "FEB");
  });

  test("prodi dari fakultas lain ditolak", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, {
      facultyId: base.fik.id,
      studyProgramId: base.feb.programs[0].id,
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.studyProgramId);
  });

  test("ganti fakultas mengosongkan prodi lama", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    await patch(cookie, { studyProgramId: base.fik.programs[0].id });
    const res = await patch(cookie, { facultyId: base.feb.id });

    assert.equal(res.body.data.faculty.code, "FEB");
    assert.equal(res.body.data.studyProgram, null);
  });

  test("fakultas dari kampus lain ditolak", async () => {
    const other = await prisma.campus.create({
      data: { name: "Kampus Lain", emailDomain: "lain.example.test" },
    });
    const foreign = await prisma.faculty.create({ data: { campusId: other.id, name: "Teknik" } });
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, { facultyId: foreign.id });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.facultyId);
  });

  test("link portofolio selain http/https ditolak", async () => {
    const { cookie } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, { mainRole: "Backend", portfolio: "javascript:alert(1)" });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.portfolio);
  });

  test("kolom di luar profil (mis. roles, email) ditolak", async () => {
    const { cookie, user } = await createUser({ campusId: base.campus.id });
    const res = await patch(cookie, { roles: ["ADMIN"], email: "x@example.test" });

    assert.equal(res.status, 400);
    const roles = await prisma.userRole.findMany({ where: { userId: user.id } });
    assert.deepEqual(roles.map((r) => r.role), ["PARTICIPANT"]);
  });
});

describe("GET /users/:id", () => {
  test("menampilkan profil publik tanpa email", async () => {
    const owner = await createUser({ campusId: base.campus.id, name: "Dina" });
    await patch(owner.cookie, { mainRole: "Data", studyProgramId: base.fik.programs[0].id });
    const viewer = await createUser({ campusId: base.campus.id });

    const res = await request("GET", `/users/${owner.user.id}`, { cookie: viewer.cookie });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, "Dina");
    assert.equal(res.body.data.skillProfile.mainRole, "Data");
    assert.equal(res.body.data.faculty.code, "FIK");
    assert.ok(!JSON.stringify(res.body).includes(owner.user.email));
    assert.ok(!JSON.stringify(res.body).includes("googleSub"));
  });

  test("ditolak tanpa login", async () => {
    const owner = await createUser();
    const res = await request("GET", `/users/${owner.user.id}`);
    assert.equal(res.status, 401);
  });

  test("akun yang sudah dihapus tidak ditemukan", async () => {
    const owner = await createUser();
    await prisma.user.update({ where: { id: owner.user.id }, data: { deletedAt: new Date() } });
    const viewer = await createUser();

    const res = await request("GET", `/users/${owner.user.id}`, { cookie: viewer.cookie });
    assert.equal(res.status, 404);
  });
});
