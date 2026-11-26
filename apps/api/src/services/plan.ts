import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Paket aktif: langganan yang masih berlaku, selain itu plan FREE. Kuota selalu dibaca dari sini.
export async function getActivePlan(userId: string, db: Prisma.TransactionClient = prisma) {
  const now = new Date();
  const subscription = await db.subscription.findFirst({
    where: { userId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
    include: { plan: true },
  });
  if (subscription) return { plan: subscription.plan, endsAt: subscription.endsAt };

  const plan = await db.plan.findUnique({ where: { code: "FREE" } });
  if (!plan) throw new Error("Plan FREE belum ada di database; jalankan seed");
  return { plan, endsAt: null };
}
