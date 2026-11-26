import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { userSearchQuery } from "../schemas/profile.js";
import { getPublicProfile, searchUsers } from "../services/profile.js";

export const userRouter = Router();

// Mencari orang untuk diundang ke lobby (FR-16, FR-48).
userRouter.get("/", requireAuth, async (req, res) => {
  res.json(await searchUsers(req.user!.id, userSearchQuery.parse(req.query)));
});

userRouter.get("/:id", requireAuth, async (req, res) => {
  res.json({ data: await getPublicProfile(String(req.params.id)) });
});
