import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createUser, prisma, request, startApi, stopApi, subscribePro } from "./helpers.js";
import {
  act, createdLobby, join, lobbyRow, lobbyWorld, openLobby, view, yesterday,
} from "./lobby-helpers.js";

let w: Awaited<ReturnType<typeof lobbyWorld>>;

before(startApi);
after(stopApi);
beforeEach(async () => {
  w = await lobbyWorld();
});

describe("membuat lobby (FR-12)", () => {
  test("lobby baru berstatus OPEN dan host menempati satu slot", async () => {
    const res = await openLobby(w.host, w.event.id);

    assert.equal(res.status, 201);
    const lobby = res.body.data;
    assert.equal(lobby.status, "OPEN");
    assert.equal(lobby.slots, 3);
    assert.equal(lobby.filledSlots, 1);
    assert.deepEqual(lobby.openRoles, ["Frontend", "UI/UX"]);
    assert.equal(lobby.hostId, w.host.user.id);
    assert.deepEqual(
      lobby.members.map((m: { role: string; isHost: boolean }) => [m.role, m.isHost]),
      [["Backend", true]],
    );
    assert.ok(lobby.inviteCode.length >= 10);
  });

  test("ditolak tanpa login", async () => {
    assert.equal((await request("POST", "/lobbies", { body: {} })).status, 401);
  });

  test("role utama wajib terisi", async () => {
    const empty = await createUser({ campusId: w.base.campus.id });
    const res = await openLobby(empty, w.event.id);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "PROFILE_INCOMPLETE");
  });

  test("hanya akun peserta", async () => {
    const mentor = await createUser({ role: "MENTOR" });
    assert.equal((await openLobby(mentor, w.event.id)).status, 403);
  });

  test("slot harus 2 sampai batas lomba", async () => {
    for (const slots of [1, 5]) {
      const res = await openLobby(w.host, w.event.id, {
        slots,
        rolesNeeded: Array(Math.max(slots - 1, 0)).fill("Data"),
      });
      assert.equal(res.status, 400, String(slots));
      assert.ok(res.body.error.fields.slots);
    }
  });

  test("jumlah role harus sama dengan slot selain host", async () => {
    const res = await openLobby(w.host, w.event.id, { slots: 3, rolesNeeded: ["Data"] });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.rolesNeeded);
  });

  test("hanya untuk lomba tim yang tayang dan belum lewat deadline", async () => {
    const solo = await w.lomba({ tipePeserta: "INDIVIDU", teamSizeMax: null });
    const draft = await w.lomba({ published: false });
    const past = await w.lomba({ deadline: yesterday(), visibleUntil: yesterday() });

    assert.equal((await openLobby(w.host, solo.id)).status, 400);
    for (const id of [draft.id, past.id, "tidak-ada"]) {
      assert.equal((await openLobby(w.host, id)).status, 404, id);
    }
  });

  test("satu lobby per lomba untuk satu orang, termasuk yang sudah terkunci", async () => {
    await subscribePro(w.host.user.id, w.base.pro.id);
    const lobby = await createdLobby(w.host, w.event.id);
    assert.equal((await openLobby(w.host, w.event.id)).status, 409);

    await prisma.lobby.update({ where: { id: lobby.id }, data: { status: "LOCKED" } });
    assert.equal((await openLobby(w.host, w.event.id)).status, 409);
  });

  test("akun Free hanya satu lobby aktif; Pro bisa lebih", async () => {
    await createdLobby(w.host, w.event.id);
    const second = await w.lomba();

    const blocked = await openLobby(w.host, second.id);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, "QUOTA_EXCEEDED");

    await subscribePro(w.host.user.id, w.base.pro.id);
    assert.equal((await openLobby(w.host, second.id)).status, 201);
  });

  test("lobby terkunci atau bubar tidak memakan kuota", async () => {
    const first = await createdLobby(w.host, w.event.id);
    await prisma.lobby.update({ where: { id: first.id }, data: { status: "LOCKED" } });

    assert.equal((await openLobby(w.host, (await w.lomba()).id)).status, 201);
  });

  test("pembuatan bersamaan tidak melewati kuota", async () => {
    const events = await Promise.all([w.lomba(), w.lomba(), w.lomba(), w.lomba()]);
    const results = await Promise.all(events.map((e) => openLobby(w.host, e.id)));

    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(await prisma.lobby.count(), 1);
  });
});

describe("browse lobby (FR-13, FR-48)", () => {
  const browse = (query = "") => request("GET", `/lobbies${query}`, { cookie: w.host.cookie });
  const names = (res: { body: { data: { teamName: string }[] } }) =>
    res.body.data.map((l) => l.teamName).sort();

  test("hanya lobby OPEN, dengan slot terisi dan role yang kurang", async () => {
    const open = await createdLobby(w.host, w.event.id, { teamName: "Terbuka" });
    const other = await w.person();
    const full = await createdLobby(other, w.event.id, { slots: 2, teamName: "Penuh" });
    await join(other, await w.person(), full.id, "Frontend");

    const res = await browse();

    assert.equal(res.status, 200);
    assert.deepEqual(names(res), ["Terbuka"]);
    const card = res.body.data[0];
    assert.equal(card.id, open.id);
    assert.equal(card.filledSlots, 1);
    assert.deepEqual(card.openRoles, ["Frontend", "UI/UX"]);
    assert.equal(card.kegiatan.id, w.event.id);
    assert.equal(card.inviteCode, undefined);
    assert.equal(res.body.meta.total, 1);
  });

  test("filter lomba, role yang masih kosong, fakultas dan prodi host", async () => {
    const fikHost = await w.person();
    await prisma.user.update({
      where: { id: fikHost.user.id },
      data: { facultyId: w.base.fik.id, studyProgramId: w.base.fik.programs[0].id },
    });
    const second = await w.lomba();
    await createdLobby(w.host, w.event.id, { rolesNeeded: ["Frontend", "UI/UX"], teamName: "Satu" });
    await createdLobby(fikHost, second.id, { slots: 2, rolesNeeded: ["Data"], teamName: "Dua" });

    assert.deepEqual(names(await browse(`?kegiatanId=${second.id}`)), ["Dua"]);
    assert.deepEqual(names(await browse("?role=Frontend")), ["Satu"]);
    assert.deepEqual(names(await browse(`?facultyId=${w.base.fik.id}`)), ["Dua"]);
    assert.deepEqual(names(await browse(`?studyProgramId=${w.base.fik.programs[0].id}`)), ["Dua"]);
  });

  test("role yang sudah terisi tidak muncul di filter", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    await join(w.host, await w.person(), lobby.id, "Frontend");

    assert.equal((await browse("?role=Frontend")).body.meta.total, 0);
    assert.equal((await browse("?role=UI%2FUX")).body.meta.total, 1);
  });

  test("lomba yang ditarik admin disembunyikan", async () => {
    await createdLobby(w.host, w.event.id);
    await prisma.kegiatan.update({ where: { id: w.event.id }, data: { published: false } });

    assert.equal((await browse()).body.meta.total, 0);
  });

  test("lewat deadline: otomatis DISBANDED dan permintaan yang menunggu ditolak", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    const asker = await w.person();
    await act(asker, `/${lobby.id}/join-requests`, { role: "Frontend" });
    await prisma.kegiatan.update({
      where: { id: w.event.id },
      data: { deadline: yesterday(), visibleUntil: yesterday() },
    });

    assert.equal((await browse()).body.meta.total, 0);
    const row = await lobbyRow(lobby.id);
    assert.equal(row.status, "DISBANDED");
    assert.equal(row.members.find((m) => m.userId === asker.user.id)?.status, "REJECTED");
  });

  test("lobby terkunci tetap terkunci setelah deadline", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    await prisma.lobby.update({ where: { id: lobby.id }, data: { status: "LOCKED" } });
    await prisma.kegiatan.update({ where: { id: w.event.id }, data: { deadline: yesterday() } });

    assert.equal((await view(w.host, lobby.id)).body.data.status, "LOCKED");
  });
});

describe("detail, tautan, dan daftar saya", () => {
  test("kode dan permintaan yang menunggu hanya terlihat oleh host", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    const asker = await w.person("Peminta");
    const stranger = await w.person();
    await act(asker, `/${lobby.id}/join-requests`, { role: "Frontend" });

    const asHost = (await view(w.host, lobby.id)).body.data;
    assert.equal(asHost.inviteCode, lobby.inviteCode);
    assert.deepEqual(
      asHost.pending.map((p: { name: string; origin: string }) => [p.name, p.origin]),
      [["Peminta", "REQUEST"]],
    );

    const asStranger = (await view(stranger, lobby.id)).body.data;
    assert.equal(asStranger.inviteCode, undefined);
    assert.equal(asStranger.pending, undefined);
    assert.equal(asStranger.me, null);
    assert.ok(!JSON.stringify(asStranger).includes("@mahasiswa"));

    const asAsker = (await view(asker, lobby.id)).body.data;
    assert.deepEqual(asAsker.me, {
      isHost: false, status: "PENDING", origin: "REQUEST", role: "Frontend",
    });
  });

  test("polling: 304 bila tidak berubah, 200 setelah ada perubahan", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    const first = await view(w.host, lobby.id);
    const etag = first.headers.get("etag")!;
    // Meniru revalidasi cache browser. Tanpa cache-control sendiri, fetch menambahkan
    // "no-cache" pada request bersyarat, dan server lalu selalu membalas 200.
    const headers = { "if-none-match": etag, "cache-control": "max-age=0" };
    const poll = () => request("GET", `/lobbies/${lobby.id}`, { cookie: w.host.cookie, headers });

    assert.equal((await poll()).status, 304);
    await act(await w.person(), `/${lobby.id}/join-requests`, { role: "Frontend" });
    assert.equal((await poll()).status, 200);
  });

  test("pratinjau lewat kode tanpa login dan tanpa data anggota", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    const res = await request("GET", `/lobbies/by-code/${lobby.inviteCode}`);

    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body.data).sort(), [
      "filledSlots", "id", "kegiatan", "openRoles", "slots", "status", "teamName",
    ]);
  });

  test("hanya host yang bisa membuat ulang kode; kode lama mati", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    const stranger = await w.person();
    assert.equal((await act(stranger, `/${lobby.id}/invite-code/regenerate`)).status, 403);

    const res = await act(w.host, `/${lobby.id}/invite-code/regenerate`);

    assert.notEqual(res.body.data.inviteCode, lobby.inviteCode);
    assert.equal((await request("GET", `/lobbies/by-code/${lobby.inviteCode}`)).status, 404);
  });

  test("lobby tidak ada dijawab 404", async () => {
    assert.equal((await view(w.host, "tidak-ada")).status, 404);
  });

  test("GET /me/lobbies memuat lobby saya, undangan, dan permintaan yang menunggu", async () => {
    await subscribePro(w.host.user.id, w.base.pro.id);
    const mine = await createdLobby(w.host, w.event.id, { teamName: "Punyaku" });
    const other = await w.person();
    const second = await w.lomba();
    const theirs = await createdLobby(other, second.id, { teamName: "Mengundang" });
    await act(other, `/${theirs.id}/invites`, { userId: w.host.user.id, role: "Frontend" });

    const res = await request("GET", "/me/lobbies", { cookie: w.host.cookie });

    assert.deepEqual(
      res.body.data.map((l: { id: string; me: { status: string; isHost: boolean } }) =>
        [l.id, l.me.status, l.me.isHost]),
      [[theirs.id, "PENDING", false], [mine.id, "ACCEPTED", true]],
    );
  });

  test("detail lomba menampilkan lobby terbuka beserta role yang kurang", async () => {
    await createdLobby(w.host, w.event.id);
    const res = await request("GET", `/kegiatan/${w.event.id}`);

    assert.deepEqual(res.body.data.lobbies[0].openRoles, ["Frontend", "UI/UX"]);
    assert.equal(res.body.data.lobbies[0].filledSlots, 1);
  });
});
