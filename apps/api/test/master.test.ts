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

describe("GET /master/faculties", () => {
  test("ditolak tanpa login", async () => {
    assert.equal((await request("GET", "/master/faculties")).status, 401);
  });

  test("mengembalikan fakultas kampus pengguna beserta prodinya, urut nama", async () => {
    const other = await prisma.campus.create({
      data: { name: "Kampus Lain", emailDomain: "lain.example.test" },
    });
    await prisma.faculty.create({ data: { campusId: other.id, name: "Teknik" } });
    const { cookie } = await createUser({ campusId: base.campus.id });

    const res = await request("GET", "/master/faculties", { cookie });

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((f: { code: string }) => f.code),
      ["FEB", "FIK"],
    );
    assert.deepEqual(res.body.data[1].programs, [
      { id: base.fik.programs[0].id, name: "Informatika", level: "S1" },
    ]);
  });

  test("pengguna tanpa kampus (admin, mentor eksternal) melihat semua fakultas", async () => {
    const { cookie } = await createUser();
    const res = await request("GET", "/master/faculties", { cookie });

    assert.equal(res.body.data.length, 2);
  });
});
