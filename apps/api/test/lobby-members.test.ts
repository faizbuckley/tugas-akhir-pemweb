import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createUser, prisma, startApi, stopApi, subscribePro } from "./helpers.js";
import {
  act, createdLobby, join, lobbyRow, lobbyWorld, memberStatus, openLobby,
} from "./lobby-helpers.js";

let w: Awaited<ReturnType<typeof lobbyWorld>>;
let lobby: { id: string };

before(startApi);
after(stopApi);
beforeEach(async () => {
  w = await lobbyWorld();
  lobby = await createdLobby(w.host, w.event.id); // 3 slot: Frontend, UI/UX
});

const ask = (who: Parameters<typeof act>[0], role = "Frontend", id = lobby.id) =>
  act(who, `/${id}/join-requests`, { role });
const accept = (userId: string, by = w.host, id = lobby.id) =>
  act(by, `/${id}/join-requests/${userId}/accept`);
const invite = (userId: string, role = "Frontend", by = w.host) =>
  act(by, `/${lobby.id}/invites`, { userId, role });

describe("request join (FR-14)", () => {
  test("tersimpan menunggu tanpa mengisi slot", async () => {
    const a = await w.person();
    const res = await ask(a);

    assert.equal(res.status, 201);
    assert.equal(res.body.data.me.status, "PENDING");
    assert.equal(res.body.data.filledSlots, 1);
  });

  test("role dicocokkan tanpa melihat huruf besar kecil", async () => {
    const res = await ask(await w.person(), "frontend");
    assert.equal(res.body.data.me.role, "Frontend");
  });

  test("role harus salah satu yang kosong", async () => {
    const res = await ask(await w.person(), "Data");

    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.role);
  });

  test("satu permintaan aktif per orang per lobby", async () => {
    const a = await w.person();
    await ask(a);

    assert.equal((await ask(a, "UI/UX")).status, 409);
    assert.equal((await ask(w.host)).status, 409);
  });

  test("butuh role utama", async () => {
    const empty = await createUser({ campusId: w.base.campus.id });
    assert.equal((await ask(empty)).body.error.code, "PROFILE_INCOMPLETE");
  });

  test("lobby penuh, terkunci, atau bubar menolak permintaan", async () => {
    const a = await w.person();
    for (const status of ["FULL", "LOCKED", "DISBANDED"] as const) {
      await prisma.lobby.update({ where: { id: lobby.id }, data: { status } });
      assert.equal((await ask(a)).status, 409, status);
    }
  });

  test("yang sudah mencapai kuota tidak bisa meminta gabung", async () => {
    const busy = await w.person();
    await createdLobby(busy, (await w.lomba()).id);

    assert.equal((await ask(busy)).body.error.code, "QUOTA_EXCEEDED");
  });

  test("peminta bisa membatalkan, lalu mengajukan lagi", async () => {
    const a = await w.person();
    await ask(a);

    assert.equal((await act(a, `/${lobby.id}/leave`)).status, 200);
    assert.equal(await memberStatus(lobby.id, a.user.id), "LEFT");
    assert.equal((await ask(a)).status, 201);
  });
});

describe("terima dan tolak (FR-15)", () => {
  test("menerima mengisi slot dan role", async () => {
    const a = await w.person();
    await ask(a);
    const res = await accept(a.user.id);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.filledSlots, 2);
    assert.deepEqual(res.body.data.openRoles, ["UI/UX"]);
    assert.equal(res.body.data.status, "OPEN");
  });

  test("slot habis: FULL dan yang masih menunggu ditolak otomatis", async () => {
    const [a, b, c, d] = [await w.person(), await w.person(), await w.person(), await w.person()];
    await ask(a);
    await ask(b);
    await ask(c, "UI/UX");
    await invite(d.user.id, "UI/UX");
    await accept(a.user.id);
    const res = await accept(c.user.id);

    assert.equal(res.body.data.status, "FULL");
    assert.equal(await memberStatus(lobby.id, b.user.id), "REJECTED");
    assert.equal(await memberStatus(lobby.id, d.user.id), "REJECTED");
  });

  test("role yang sudah terisi tidak bisa diterima dua kali", async () => {
    const a = await w.person();
    const b = await w.person();
    await ask(a);
    await ask(b);
    await accept(a.user.id);

    assert.equal((await accept(b.user.id)).status, 409);
    assert.equal(await memberStatus(lobby.id, b.user.id), "PENDING");
  });

  test("hanya host", async () => {
    const a = await w.person();
    await ask(a);

    assert.equal((await accept(a.user.id, a)).status, 403);
    assert.equal((await act(a, `/${lobby.id}/join-requests/${a.user.id}/reject`)).status, 403);
  });

  test("tolak", async () => {
    const a = await w.person();
    await ask(a);
    const res = await act(w.host, `/${lobby.id}/join-requests/${a.user.id}/reject`);

    assert.equal(res.status, 200);
    assert.equal(await memberStatus(lobby.id, a.user.id), "REJECTED");
    assert.equal((await accept(a.user.id)).status, 404);
  });

  test("ditolak bila peminta sudah penuh kuotanya saat akan diterima", async () => {
    const a = await w.person();
    await ask(a);
    await createdLobby(a, (await w.lomba()).id);

    const res = await accept(a.user.id);

    assert.equal(res.status, 409);
    assert.equal((await lobbyRow(lobby.id)).openRoles.length, 2);
  });

  test("peminta yang sudah masuk tim lain untuk lomba yang sama ditolak", async () => {
    const a = await w.person();
    await subscribePro(a.user.id, w.base.pro.id);
    await ask(a);
    await createdLobby(a, w.event.id);

    assert.equal((await accept(a.user.id)).status, 409);
  });

  test("NFR-6: dua penerimaan bersamaan untuk slot terakhir, hanya satu berhasil", async () => {
    const other = await w.person();
    const duo = await createdLobby(other, (await w.lomba()).id, { slots: 2 });
    const askers = await Promise.all([w.person(), w.person(), w.person(), w.person()]);
    for (const a of askers) await ask(a, "Frontend", duo.id);

    const results = await Promise.all(askers.map((a) => accept(a.user.id, other, duo.id)));

    assert.equal(results.filter((r) => r.status === 200).length, 1);
    const row = await lobbyRow(duo.id);
    assert.equal(row.status, "FULL");
    assert.equal(row.members.filter((m) => m.status === "ACCEPTED").length, 2);
  });

  test("NFR-6: dua lobby menerima orang yang sama bersamaan, kuota tetap dijaga", async () => {
    const other = await w.person();
    const second = await createdLobby(other, (await w.lomba()).id);
    const a = await w.person();
    await ask(a);
    await ask(a, "Frontend", second.id);

    const results = await Promise.all([accept(a.user.id), accept(a.user.id, other, second.id)]);

    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  });
});

describe("undangan (FR-16)", () => {
  test("yang diundang bisa menerima", async () => {
    const a = await w.person();
    const sent = await invite(a.user.id);
    assert.equal(sent.status, 201);
    assert.equal(sent.body.data.pending[0].origin, "INVITE");

    const res = await act(a, `/${lobby.id}/invites/accept`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.me.status, "ACCEPTED");
    assert.deepEqual(res.body.data.openRoles, ["UI/UX"]);
  });

  test("yang diundang bisa menolak", async () => {
    const a = await w.person();
    await invite(a.user.id);

    assert.equal((await act(a, `/${lobby.id}/invites/reject`)).status, 200);
    assert.equal(await memberStatus(lobby.id, a.user.id), "REJECTED");
  });

  test("host membatalkan undangan lewat kick", async () => {
    const a = await w.person();
    await invite(a.user.id);

    assert.equal((await act(w.host, `/${lobby.id}/kick/${a.user.id}`)).status, 200);
    assert.equal((await act(a, `/${lobby.id}/invites/accept`)).status, 404);
  });

  test("hanya host yang bisa mengundang", async () => {
    const a = await w.person();
    assert.equal((await invite(a.user.id, "Frontend", a)).status, 403);
  });

  test("tidak bisa menerima sendiri permintaan gabung lewat jalur undangan", async () => {
    const a = await w.person();
    await ask(a);

    assert.equal((await act(a, `/${lobby.id}/invites/accept`)).status, 404);
  });

  test("host tidak bisa menerima undangan atas nama yang diundang", async () => {
    const a = await w.person();
    await invite(a.user.id);

    assert.equal((await accept(a.user.id)).status, 404);
  });

  test("target harus peserta yang ada, belum di lobby ini", async () => {
    const mentor = await createUser({ role: "MENTOR" });
    const a = await w.person();
    await ask(a);

    assert.equal((await invite(mentor.user.id)).status, 404);
    assert.equal((await invite("tidak-ada")).status, 404);
    assert.equal((await invite(a.user.id)).status, 409);
    assert.equal((await invite(w.host.user.id)).status, 409);
  });

  test("menerima undangan tunduk pada kuota sendiri", async () => {
    const busy = await w.person();
    await createdLobby(busy, (await w.lomba()).id);
    await invite(busy.user.id);

    const res = await act(busy, `/${lobby.id}/invites/accept`);

    assert.equal(res.body.error.code, "QUOTA_EXCEEDED");
  });
});

describe("keluar, kick, dan pindah host (FR-17)", () => {
  test("anggota keluar: slot kosong lagi, FULL kembali OPEN, Siap di-reset", async () => {
    const a = await w.person();
    const b = await w.person();
    await join(w.host, a, lobby.id, "Frontend");
    await join(w.host, b, lobby.id, "UI/UX");
    await act(w.host, `/${lobby.id}/ready`);
    await act(a, `/${lobby.id}/ready`);

    const res = await act(b, `/${lobby.id}/leave`);

    assert.equal(res.body.data.status, "OPEN");
    assert.deepEqual(res.body.data.openRoles, ["UI/UX"]);
    assert.ok((await lobbyRow(lobby.id)).members.every((m) => !m.ready));
  });

  test("kick", async () => {
    const a = await w.person();
    await join(w.host, a, lobby.id, "Frontend");

    const res = await act(w.host, `/${lobby.id}/kick/${a.user.id}`);

    assert.equal(res.status, 200);
    assert.equal(await memberStatus(lobby.id, a.user.id), "KICKED");
    assert.deepEqual([...res.body.data.openRoles].sort(), ["Frontend", "UI/UX"]);
  });

  test("hanya host yang bisa kick, dan tidak bisa kick diri sendiri", async () => {
    const a = await w.person();
    await join(w.host, a, lobby.id, "Frontend");

    assert.equal((await act(a, `/${lobby.id}/kick/${w.host.user.id}`)).status, 403);
    assert.equal((await act(w.host, `/${lobby.id}/kick/${w.host.user.id}`)).status, 409);
  });

  test("orang luar tidak bisa keluar", async () => {
    assert.equal((await act(await w.person(), `/${lobby.id}/leave`)).status, 404);
  });

  test("host keluar: pindah ke anggota yang paling lama bergabung", async () => {
    const early = await w.person("Awal");
    const late = await w.person("Baru");
    await ask(late, "UI/UX"); // meminta lebih dulu, tetapi diterima belakangan
    await join(w.host, early, lobby.id, "Frontend");
    await accept(late.user.id);

    await act(w.host, `/${lobby.id}/leave`);

    const row = await lobbyRow(lobby.id);
    assert.equal(row.hostId, early.user.id);
    assert.equal(row.status, "OPEN");
    assert.deepEqual(row.openRoles, ["Backend"]);
    assert.deepEqual([...row.rolesNeeded].sort(), ["Backend", "UI/UX"]);
    assert.equal(await memberStatus(lobby.id, w.host.user.id), "LEFT");
  });

  test("host baru bisa mengelola lobby dan host lama bebas kuota", async () => {
    const a = await w.person();
    await join(w.host, a, lobby.id, "Frontend");
    await act(w.host, `/${lobby.id}/leave`);

    assert.equal((await act(a, `/${lobby.id}/invite-code/regenerate`)).status, 200);
    assert.equal((await act(w.host, `/${lobby.id}/disband`)).status, 403);
    assert.equal((await openLobby(w.host, (await w.lomba()).id)).status, 201);
  });

  test("host keluar saat sendirian: lobby bubar", async () => {
    const asker = await w.person();
    await ask(asker);

    const res = await act(w.host, `/${lobby.id}/leave`);

    assert.equal(res.body.data.status, "DISBANDED");
    assert.equal(await memberStatus(lobby.id, asker.user.id), "REJECTED");
  });
});

describe("ready check (FR-18) dan bubar (FR-19)", () => {
  const fill = async () => {
    const a = await w.person();
    const b = await w.person();
    await join(w.host, a, lobby.id, "Frontend");
    await join(w.host, b, lobby.id, "UI/UX");
    return [a, b];
  };
  const ready = (who: Parameters<typeof act>[0], value = true) =>
    act(who, `/${lobby.id}/ready`, { ready: value });

  test("Siap hanya saat FULL", async () => {
    assert.equal((await ready(w.host)).status, 409);
  });

  test("semua Siap mengunci lobby", async () => {
    const [a, b] = await fill();
    assert.equal((await ready(w.host)).body.data.status, "FULL");
    assert.equal((await ready(a)).body.data.status, "FULL");
    assert.equal((await ready(b)).body.data.status, "LOCKED");
  });

  test("Siap bisa dibatalkan", async () => {
    const [a, b] = await fill();
    await ready(a);
    await ready(a, false);
    await ready(w.host);

    assert.equal((await ready(b)).body.data.status, "FULL");
  });

  test("Siap bersamaan tetap mengunci", async () => {
    const [a, b] = await fill();
    await Promise.all([ready(w.host), ready(a), ready(b)]);

    assert.equal((await lobbyRow(lobby.id)).status, "LOCKED");
  });

  test("orang luar tidak bisa Siap", async () => {
    await fill();
    assert.equal((await ready(await w.person())).status, 404);
  });

  test("lobby terkunci tidak bisa diubah", async () => {
    const [a] = await fill();
    await prisma.lobby.update({ where: { id: lobby.id }, data: { status: "LOCKED" } });

    for (const [who, path] of [
      [a, "/leave"],
      [w.host, `/kick/${a.user.id}`],
      [w.host, "/disband"],
      [w.host, "/invite-code/regenerate"],
      [a, "/ready"],
    ] as const) {
      assert.equal((await act(who, `/${lobby.id}${path}`)).status, 409, path);
    }
  });

  test("host membubarkan; yang menunggu ditolak", async () => {
    const asker = await w.person();
    await ask(asker);

    const res = await act(w.host, `/${lobby.id}/disband`);

    assert.equal(res.body.data.status, "DISBANDED");
    assert.equal(await memberStatus(lobby.id, asker.user.id), "REJECTED");
  });

  test("anggota biasa tidak bisa membubarkan", async () => {
    const [a] = await fill();
    assert.equal((await act(a, `/${lobby.id}/disband`)).status, 403);
  });
});
