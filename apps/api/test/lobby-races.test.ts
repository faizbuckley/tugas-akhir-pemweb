import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, request, startApi, stopApi } from "./helpers.js";
import { act, createdLobby, lobbyWorld, view, yesterday } from "./lobby-helpers.js";

let w: Awaited<ReturnType<typeof lobbyWorld>>;

before(startApi);
after(stopApi);
beforeEach(async () => {
  w = await lobbyWorld();
});

describe("keadaan di pinggir aturan", () => {
  test("lomba yang ditarik admin tidak menerima anggota baru", async () => {
    const lobby = await createdLobby(w.host, w.event.id);
    const [asker, invited, other] = [await w.person(), await w.person(), await w.person()];
    await act(asker, `/${lobby.id}/join-requests`, { role: "Frontend" });
    await act(w.host, `/${lobby.id}/invites`, { userId: invited.user.id, role: "UI/UX" });
    await prisma.kegiatan.update({ where: { id: w.event.id }, data: { published: false } });

    const results = [
      await act(other, `/${lobby.id}/join-requests`, { role: "Frontend" }),
      await act(w.host, `/${lobby.id}/join-requests/${asker.user.id}/accept`),
      await act(w.host, `/${lobby.id}/invites`, { userId: other.user.id, role: "Frontend" }),
      await act(invited, `/${lobby.id}/invites/accept`),
    ];

    assert.deepEqual(results.map((r) => r.status), [409, 409, 409, 409]);
  });

  test("akun yang dihapus saat sedang diterima tidak pernah jadi anggota", async () => {
    for (let round = 0; round < 15; round++) {
      w = await lobbyWorld();
      const lobby = await createdLobby(w.host, w.event.id);
      const asker = await w.person();
      await act(asker, `/${lobby.id}/join-requests`, { role: "Frontend" });

      const accept = () => act(w.host, `/${lobby.id}/join-requests/${asker.user.id}/accept`);
      const remove = () => request("DELETE", "/me", { cookie: asker.cookie });
      const [a, b] = await Promise.all(round % 2 ? [accept(), remove()] : [remove(), accept()]);

      assert.ok(a.status < 500 && b.status < 500, `putaran ${round}: ${a.status} ${b.status}`);
      const members = await prisma.lobbyMember.count({
        where: { userId: asker.user.id, status: { in: ["ACCEPTED", "PENDING"] } },
      });
      assert.equal(members, 0, `putaran ${round}`);
    }
  });

  test("permintaan bersamaan setelah deadline tidak memicu error server", async () => {
    for (let round = 0; round < 10; round++) {
      w = await lobbyWorld();
      const lobby = await createdLobby(w.host, w.event.id);
      const askers = [await w.person(), await w.person(), await w.person()];
      for (const a of askers) await act(a, `/${lobby.id}/join-requests`, { role: "Frontend" });
      await prisma.kegiatan.update({ where: { id: w.event.id }, data: { deadline: yesterday() } });

      const results = await Promise.all([
        ...askers.map((a) => act(w.host, `/${lobby.id}/join-requests/${a.user.id}/accept`)),
        view(w.host, lobby.id),
        view(w.host, lobby.id),
      ]);

      assert.ok(results.every((r) => r.status < 500), results.map((r) => r.status).join());
    }
  });
});
