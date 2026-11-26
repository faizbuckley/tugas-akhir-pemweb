import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createUser, request, resetDb, seedBase, startApi, stopApi } from "./helpers.js";

let base: Awaited<ReturnType<typeof seedBase>>;

before(startApi);
after(stopApi);
beforeEach(async () => {
  await resetDb();
  base = await seedBase();
});

describe("format error", () => {
  test("JSON rusak dijawab 400, bukan 500", async () => {
    const { cookie } = await createUser();
    const res = await request("PATCH", "/me/profile", { cookie, rawBody: "{rusak" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_JSON");
  });
});

describe("link kegiatan", () => {
  test("admin tidak bisa menyimpan registerUrl selain http/https", async () => {
    const { cookie } = await createUser({ role: "ADMIN" });
    const res = await request("POST", "/admin/kegiatan", {
      cookie,
      body: {
        jenis: "LOMBA",
        title: "Lomba Uji",
        organizer: "Panitia",
        description: "Deskripsi lomba untuk test.",
        mode: "ONLINE",
        registerUrl: "javascript:alert(1)",
        categoryId: base.category.id,
        tingkat: "KAMPUS",
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        tipePeserta: "INDIVIDU",
      },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.registerUrl);
  });
});
