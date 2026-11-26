import { type Request, type Response, Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { browseQuery, createLobbyInput, inviteInput, joinInput, readyInput } from "../schemas/lobby.js";
import { expireLobbies } from "../services/lobby-core.js";
import * as lobby from "../services/lobby.js";
import { browseLobbies, lobbyDetail, previewByCode } from "../services/lobby-view.js";

export const lobbyRouter = Router();

lobbyRouter.use(async (_req, _res, next) => {
  await expireLobbies();
  next();
});

// Publik; dibatasi supaya kode tidak bisa ditebak beruntun.
lobbyRouter.get("/by-code/:code", rateLimit(30), async (req, res) => {
  res.json({ data: await previewByCode(String(req.params.code)) });
});

lobbyRouter.use(requireAuth);

// Semua aksi membalas keadaan lobby terbaru supaya FE tidak perlu memanggil lagi.
async function reply(req: Request, res: Response, lobbyId: string, status = 200) {
  res.status(status).json({ data: await lobbyDetail(lobbyId, req.user!.id) });
}

const param = (req: Request, name: string) => String(req.params[name]);

lobbyRouter.get("/", async (req, res) => {
  res.json(await browseLobbies(browseQuery.parse(req.query)));
});

lobbyRouter.post("/", async (req, res) => {
  const id = await lobby.createLobby(req.user!.id, createLobbyInput.parse(req.body));
  await reply(req, res, id, 201);
});

lobbyRouter.get("/:id", async (req, res) => {
  // Browser boleh menyimpan, tetapi harus cek ETag setiap kali (polling, FR-20).
  res.set("Cache-Control", "private, no-cache");
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/join-requests", async (req, res) => {
  const { role } = joinInput.parse(req.body);
  await lobby.requestJoin(param(req, "id"), req.user!.id, role);
  await reply(req, res, param(req, "id"), 201);
});

lobbyRouter.post("/:id/join-requests/:userId/accept", async (req, res) => {
  await lobby.acceptRequest(param(req, "id"), req.user!.id, param(req, "userId"));
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/join-requests/:userId/reject", async (req, res) => {
  await lobby.rejectRequest(param(req, "id"), req.user!.id, param(req, "userId"));
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/invites", async (req, res) => {
  const { userId, role } = inviteInput.parse(req.body);
  await lobby.invite(param(req, "id"), req.user!.id, userId, role);
  await reply(req, res, param(req, "id"), 201);
});

lobbyRouter.post("/:id/invites/accept", async (req, res) => {
  await lobby.acceptInvite(param(req, "id"), req.user!.id);
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/invites/reject", async (req, res) => {
  await lobby.rejectInvite(param(req, "id"), req.user!.id);
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/invite-code/regenerate", async (req, res) => {
  await lobby.regenerateInviteCode(param(req, "id"), req.user!.id);
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/leave", async (req, res) => {
  await lobby.leave(param(req, "id"), req.user!.id);
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/kick/:userId", async (req, res) => {
  await lobby.kick(param(req, "id"), req.user!.id, param(req, "userId"));
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/ready", async (req, res) => {
  const { ready } = readyInput.parse(req.body ?? {});
  await lobby.setReady(param(req, "id"), req.user!.id, ready);
  await reply(req, res, param(req, "id"));
});

lobbyRouter.post("/:id/disband", async (req, res) => {
  await lobby.disbandByHost(param(req, "id"), req.user!.id);
  await reply(req, res, param(req, "id"));
});
