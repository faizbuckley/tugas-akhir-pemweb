import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getPublicProfile } from "../services/profile.js";

export const userRouter = Router();

userRouter.get("/:id", requireAuth, async (req, res) => {
  res.json({ data: await getPublicProfile(String(req.params.id)) });
});
