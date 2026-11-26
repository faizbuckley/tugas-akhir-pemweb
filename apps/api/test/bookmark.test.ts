import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createLomba, createUser, prisma, request, resetDb, seedBase, startApi, stopApi, subscribePro,
} from "./helpers.js";

let base: Awaited<ReturnType<typeof seedBase>>;
let me: Awaited<ReturnType<typeof createUser>>;

before(startApi);
after(stopApi);
beforeEach(async () => {
  await resetDb();
  base = await seedBase();
  me = await createUser({ campusId: base.campus.id });
});

const lomba = (overrides = {}) => createLomba(me.user.id, base.category.id, overrides);
const add = (id: string, cookie = me.cookie) =>
  request("POST", `/kegiatan/${id}/bookmark`, { cookie });
const list = (query = "") => request("GET", `/me/bookmarks${query}`, { cookie: me.cookie });
const many = (n: number) => Promise.all(Array.from({ length: n }, () => lomba()));
const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

describe("POST /kegiatan/:id/bookmark", () => {
  test("ditolak tanpa login", async () => {
    const item = await lomba();
    assert.equal((await request("POST", `/kegiatan/${item.id}/bookmark`)).status, 401);
  });

  test("menyimpan bookmark dan mengembalikan pemakaian kuota", async () => {
    const item = await lomba();
    const res = await add(item.id);

    assert.equal(res.status, 201);
    assert.deepEqual(res.body.data, { kegiatanId: item.id, quota: { used: 1, max: 5 } });
  });

  test("bookmark ulang tidak menambah data dan tidak dihitung dua kali", async () => {
    const item = await lomba();
    await add(item.id);
    const res = await add(item.id);

    assert.equal(res.status, 200);
    assert.equal(await prisma.bookmark.count(), 1);
  });

  test("lomba yang belum tayang, sudah lewat, atau tidak ada ditolak 404", async () => {
    const draft = await lomba({ published: false });
    const expired = await lomba({ visibleUntil: yesterday() });

    for (const id of [draft.id, expired.id, "tidak-ada"]) {
      assert.equal((await add(id)).status, 404, id);
    }
  });

  test("seminar belum bisa di-bookmark", async () => {
    const seminar = await lomba({ jenis: "SEMINAR" });
    const res = await add(seminar.id);

    assert.equal(res.status, 400);
    assert.equal(await prisma.bookmark.count(), 0);
  });

  test("akun Free berhenti di batas plan dengan kode QUOTA_EXCEEDED", async () => {
    const items = await many(6);
    for (const item of items.slice(0, 5)) assert.equal((await add(item.id)).status, 201);

    const res = await add(items[5].id);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "QUOTA_EXCEEDED");
    assert.equal(await prisma.bookmark.count(), 5);
  });

  test("batas mengikuti angka di tabel Plan", async () => {
    await prisma.plan.update({ where: { code: "FREE" }, data: { maxBookmarks: 1 } });
    const [a, b] = await many(2);
    await add(a.id);

    assert.equal((await add(b.id)).status, 403);
  });

  test("permintaan bersamaan tidak bisa melewati batas", async () => {
    const items = await many(12);
    const results = await Promise.all(items.map((item) => add(item.id)));

    assert.equal(results.filter((r) => r.status === 201).length, 5);
    assert.equal(results.filter((r) => r.status === 403).length, 7);
    assert.equal(await prisma.bookmark.count(), 5);
  });

  test("akun Pro aktif tanpa batas", async () => {
    await subscribePro(me.user.id, base.pro.id);
    const items = await many(7);
    for (const item of items) assert.equal((await add(item.id)).status, 201);
  });

  test("Pro yang sudah berakhir kembali ke batas Free", async () => {
    await subscribePro(me.user.id, base.pro.id, -1);
    const items = await many(6);
    for (const item of items.slice(0, 5)) await add(item.id);

    assert.equal((await add(items[5].id)).status, 403);
  });
});

describe("DELETE /kegiatan/:id/bookmark", () => {
  test("menghapus hanya bookmark milik sendiri", async () => {
    const item = await lomba();
    const other = await createUser();
    await add(item.id);
    await add(item.id, other.cookie);

    const res = await request("DELETE", `/kegiatan/${item.id}/bookmark`, { cookie: me.cookie });

    assert.equal(res.status, 204);
    const rows = await prisma.bookmark.findMany();
    assert.deepEqual(rows.map((r) => r.userId), [other.user.id]);
  });

  test("tetap 204 bila memang tidak di-bookmark", async () => {
    const res = await request("DELETE", "/kegiatan/tidak-ada/bookmark", { cookie: me.cookie });
    assert.equal(res.status, 204);
  });

  test("ditolak tanpa login", async () => {
    assert.equal((await request("DELETE", "/kegiatan/x/bookmark")).status, 401);
  });
});

describe("GET /me/bookmarks", () => {
  test("menampilkan milik sendiri, terbaru dulu, dengan penanda kedaluwarsa", async () => {
    const first = await lomba({ title: "Pertama" });
    const second = await lomba({ title: "Kedua" });
    await add(first.id);
    await add(second.id);
    await prisma.kegiatan.update({ where: { id: first.id }, data: { visibleUntil: yesterday() } });
    const other = await createUser();
    await add(second.id, other.cookie);

    const res = await list();

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((b: { title: string; expired: boolean }) => [b.title, b.expired]),
      [["Kedua", false], ["Pertama", true]],
    );
    assert.ok(res.body.data[0].bookmarkedAt);
    assert.deepEqual(res.body.meta, {
      page: 1, limit: 12, total: 2, totalPages: 1, quota: { used: 2, max: 5 },
    });
  });

  test("lomba yang ditarik admin disembunyikan dan tidak memakan kuota", async () => {
    const items = await many(6);
    for (const item of items.slice(0, 5)) await add(item.id);
    await prisma.kegiatan.update({ where: { id: items[0].id }, data: { published: false } });

    const res = await list();

    assert.equal(res.body.meta.total, 4);
    assert.equal((await add(items[5].id)).status, 201);
  });

  test("mendukung pagination", async () => {
    for (const item of await many(3)) await add(item.id);
    const res = await list("?page=2&limit=2");

    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.meta.totalPages, 2);
  });

  test("ditolak tanpa login", async () => {
    assert.equal((await request("GET", "/me/bookmarks")).status, 401);
  });

  test("GET /me menyertakan jumlah bookmark terpakai", async () => {
    const item = await lomba();
    await add(item.id);
    const res = await request("GET", "/me", { cookie: me.cookie });

    assert.deepEqual(res.body.data.usage, { bookmarks: 1 });
  });
});
