import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { profileInput } from "../schemas/profile.js";
import { getMe, updateProfile } from "../services/profile.js";
import { deleteAccount } from "../services/account.js";
import { listBookmarks } from "../services/bookmark.js";
import { pageQuery } from "../schemas/pagination.js";
import { expireLobbies } from "../services/lobby-core.js";
import { myLobbies } from "../services/lobby-view.js";
import { clearSessionCookie } from "../lib/jwt.js";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get("/", async (req, res) => {
  res.json({ data: await getMe(req.user!.id) });
});

meRouter.get("/bookmarks", async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  res.json(await listBookmarks(req.user!.id, page, limit));
});

meRouter.get("/lobbies", async (req, res) => {
  const { page, limit } = pageQuery.parse(req.query);
  await expireLobbies();
  res.json(await myLobbies(req.user!.id, page, limit));
});

meRouter.delete("/", async (req, res) => {
  await deleteAccount(req.user!.id);
  clearSessionCookie(res);
  res.status(204).end();
});

meRouter.patch("/profile", async (req, res) => {
  const input = profileInput.parse(req.body);
  await updateProfile(req.user!.id, input);
  res.json({ data: await getMe(req.user!.id) });
});
