import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../lib/errors.js";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      angkatan: true,
      campus: { select: { id: true, name: true } },
      faculty: { select: { id: true, name: true, code: true } },
      studyProgram: { select: { id: true, name: true, level: true } },
      skillProfile: true,
    },
  });
  if (!user) throw notFound();

  const now = new Date();
  const [subscription, freePlan] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: "desc" },
      include: { plan: true },
    }),
    prisma.plan.findUnique({ where: { code: "FREE" } }),
  ]);
  const plan = subscription?.plan ?? freePlan;

  res.json({
    data: {
      ...user,
      roles: req.user!.roles,
      profileComplete: Boolean(user.skillProfile?.mainRole),
      plan: plan
        ? {
            code: plan.code,
            name: plan.name,
            maxBookmarks: plan.maxBookmarks,
            maxActiveLobbies: plan.maxActiveLobbies,
            sessionsPerPeriod: plan.sessionsPerPeriod,
            endsAt: subscription?.endsAt ?? null,
          }
        : null,
    },
  });
});
