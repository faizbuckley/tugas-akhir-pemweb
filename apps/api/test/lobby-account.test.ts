import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createUser, prisma, request, startApi, stopApi, subscribePro } from "./helpers.js";
import { act, createdLobby, join, lobbyRow, lobbyWorld, memberStatus } from "./lobby-helpers.js";

let w: Awaited<ReturnType<typeof lobbyWorld>>;

before(startApi);
after(stopApi);
beforeEach(async () => {
  w = await lobbyWorld();
});

describe("hapus akun saat punya lobby", () => {
  test("keluar dari lobby aktif, status host dipindah, permintaan dibatalkan", async () => {
    await subscribePro(w.host.user.id, w.base.pro.id);
    const mine = await createdLobby(w.host, w.event.id);
    const member = await w.person();
    await join(w.host, member, mine.id, "Frontend");
    const other = await w.person();
    const theirs = await createdLobby(other, (await w.lomba()).id);
    await act(w.host, `/${theirs.id}/join-requests`, { role: "Frontend" });

    const res = await request("DELETE", "/me", { cookie: w.host.cookie });

    assert.equal(res.status, 204);
    const row = await lobbyRow(mine.id);
    assert.equal(row.hostId, member.user.id);
    assert.equal(row.status, "OPEN");
    assert.equal(await memberStatus(mine.id, w.host.user.id), "LEFT");
    assert.equal(await memberStatus(theirs.id, w.host.user.id), "LEFT");
  });

  test("tim yang sudah terkunci tetap utuh", async () => {
    const lobby = await createdLobby(w.host, w.event.id, { slots: 2 });
    await prisma.lobby.update({ where: { id: lobby.id }, data: { status: "LOCKED" } });

    await request("DELETE", "/me", { cookie: w.host.cookie });

    assert.equal((await lobbyRow(lobby.id)).status, "LOCKED");
    assert.equal(await memberStatus(lobby.id, w.host.user.id), "ACCEPTED");
  });
});

describe("GET /users (cari orang untuk diundang)", () => {
  const search = (query = "") => request("GET", `/users${query}`, { cookie: w.host.cookie });

  test("hanya peserta berprofil, tanpa diri sendiri dan tanpa email", async () => {
    await w.person("Sari");
    await createUser({ campusId: w.base.campus.id, name: "Tanpa Profil" });
    const gone = await w.person("Terhapus");
    await prisma.user.update({ where: { id: gone.user.id }, data: { deletedAt: new Date() } });

    const res = await search();

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((u: { name: string }) => u.name), ["Sari"]);
    assert.equal(res.body.data[0].mainRole, "Backend");
    assert.ok(!JSON.stringify(res.body).includes("@"));
    assert.equal(res.body.meta.total, 1);
  });

  test("filter nama, fakultas, dan prodi", async () => {
    const sari = await w.person("Sari Dewi");
    await w.person("Budi");
    await prisma.user.update({
      where: { id: sari.user.id },
      data: { facultyId: w.base.fik.id, studyProgramId: w.base.fik.programs[0].id },
    });

    for (const query of [
      "?q=sari",
      `?facultyId=${w.base.fik.id}`,
      `?studyProgramId=${w.base.fik.programs[0].id}`,
    ]) {
      const res = await search(query);
      assert.deepEqual(res.body.data.map((u: { name: string }) => u.name), ["Sari Dewi"], query);
    }
  });

  test("ditolak tanpa login", async () => {
    assert.equal((await request("GET", "/users")).status, 401);
  });
});
