import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";

// Pembatas sederhana per IP per jendela waktu, in-memory (NFR-13). Cukup untuk satu proses.
export function rateLimit(max: number, windowMs = 60_000): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, _res, next) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return next(new AppError(429, "RATE_LIMITED", "Terlalu banyak percobaan, coba lagi sebentar"));
    }
    next();
  };
}
