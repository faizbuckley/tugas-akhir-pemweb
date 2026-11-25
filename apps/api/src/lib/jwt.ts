import jwt from "jsonwebtoken";
import type { Response } from "express";
import { env } from "./env.js";

export const COOKIE_NAME = "va_token";

type Payload = { sub: string };

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies Payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): Payload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string" || typeof decoded.sub !== "string") return null;
    return { sub: decoded.sub };
  } catch {
    return null;
  }
}

const isProd = process.env.NODE_ENV === "production";

export function setSessionCookie(res: Response, token: string) {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const maxAge = decoded?.exp ? decoded.exp * 1000 - Date.now() : undefined;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/" });
}
