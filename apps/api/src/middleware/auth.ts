import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { COOKIE_NAME, verifyToken } from "../lib/jwt.js";
import { forbidden, unauthorized } from "../lib/errors.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Peran dibaca dari database di setiap request, jadi perubahan peran langsung berlaku.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = typeof token === "string" ? verifyToken(token) : null;
  if (!payload) return next(unauthorized());

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, deletedAt: true, roles: { select: { role: true } } },
  });
  if (!user || user.deletedAt) return next(unauthorized("Sesi tidak valid"));

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map((r) => r.role),
  };
  next();
};

export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!req.user.roles.some((r) => allowed.includes(r))) return next(forbidden());
    next();
  };
