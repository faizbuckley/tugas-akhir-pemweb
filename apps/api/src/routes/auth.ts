import { Router } from "express";
import { randomBytes } from "node:crypto";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { Role, type User } from "@prisma/client";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { clearSessionCookie, setSessionCookie, signToken } from "../lib/jwt.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const STATE_COOKIE = "va_oauth_state";
const RETURN_COOKIE = "va_oauth_return";
const isProd = process.env.NODE_ENV === "production";
const flowCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/api/auth",
  maxAge: 10 * 60 * 1000,
};

const client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL,
);

// Hanya path internal; menolak "//host", "http://..." dan backslash (cegah open redirect).
export function safeReturnTo(value: unknown): string {
  if (typeof value === "string" && /^\/(?!\/)[^\\\r\n]*$/.test(value)) return value;
  return "/";
}

class LoginError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function loginFailed(code: string) {
  return `${env.WEB_ORIGIN}/login?error=${encodeURIComponent(code)}`;
}

async function resolveUser(payload: TokenPayload): Promise<User> {
  const email = payload.email!.toLowerCase();
  const sub = payload.sub;

  // Akun yang sudah ada: dicari lewat googleSub, lalu email (admin seed / mentor yang sudah disambungkan).
  let user =
    (await prisma.user.findUnique({ where: { googleSub: sub } })) ??
    (await prisma.user.findUnique({ where: { email } }));

  if (user) {
    if (user.deletedAt) throw new LoginError("account_deleted");
    if (user.googleSub !== sub && user.googleSub.startsWith("pending:")) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleSub: sub, avatarUrl: user.avatarUrl ?? payload.picture ?? null },
      });
    }
    return user;
  }

  // Akun baru: mahasiswa kampus terdaftar.
  const domain = email.split("@")[1] ?? "";
  const campus = await prisma.campus.findUnique({ where: { emailDomain: domain } });
  if (campus) {
    return prisma.user.create({
      data: {
        googleSub: sub,
        email,
        name: payload.name ?? email,
        avatarUrl: payload.picture ?? null,
        campusId: campus.id,
        roles: { create: { role: Role.PARTICIPANT } },
      },
    });
  }

  // Akun baru: mentor eksternal yang pengajuannya sudah disetujui admin.
  const application = await prisma.mentorApplication.findFirst({
    where: { email, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
  });
  if (application) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          googleSub: sub,
          email,
          name: application.fullName,
          avatarUrl: payload.picture ?? null,
          roles: { create: { role: Role.MENTOR } },
        },
      });
      await tx.mentor.create({
        data: {
          userId: created.id,
          expertise: [application.field],
          bio: application.motivation,
          meetUrl: application.meetUrl,
        },
      });
      await tx.mentorApplication.update({
        where: { id: application.id },
        data: { userId: created.id },
      });
      return created;
    });
  }

  // Beda pesan agar pengguna tahu langkah berikutnya.
  const pending = await prisma.mentorApplication.findFirst({
    where: { email, status: "PENDING" },
  });
  throw new LoginError(pending ? "mentor_pending" : "domain_not_allowed");
}

authRouter.get("/google", rateLimit(20), (req, res) => {
  const state = randomBytes(24).toString("hex");
  res.cookie(STATE_COOKIE, state, flowCookie);
  res.cookie(RETURN_COOKIE, safeReturnTo(req.query.returnTo), flowCookie);
  const url = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
    // Petunjuk UI saja; verifikasi domain tetap di server.
    hd: env.ALLOWED_EMAIL_DOMAIN,
  });
  res.redirect(url);
});

authRouter.get("/google/callback", rateLimit(20), async (req, res) => {
  const expectedState = req.cookies?.[STATE_COOKIE];
  const returnTo = safeReturnTo(req.cookies?.[RETURN_COOKIE]);
  res.clearCookie(STATE_COOKIE, { path: "/api/auth" });
  res.clearCookie(RETURN_COOKIE, { path: "/api/auth" });

  try {
    if (req.query.error) throw new LoginError("google_denied");
    const { code, state } = req.query;
    if (typeof code !== "string" || typeof state !== "string" || !expectedState || state !== expectedState) {
      throw new LoginError("state_mismatch");
    }

    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new LoginError("google_failed");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) throw new LoginError("google_failed");
    if (!payload.email_verified) throw new LoginError("email_unverified");

    const user = await resolveUser(payload);
    setSessionCookie(res, signToken(user.id));
    res.redirect(`${env.WEB_ORIGIN}${returnTo}`);
  } catch (err) {
    if (err instanceof LoginError) return res.redirect(loginFailed(err.code));
    console.error("Login Google gagal:", err);
    res.redirect(loginFailed("google_failed"));
  }
});

authRouter.post("/logout", requireAuth, (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});
