import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, "VALIDATION_ERROR", message, fields);
export const unauthorized = (message = "Silakan login terlebih dahulu") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Kamu tidak punya akses ke sumber ini") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Data tidak ditemukan") =>
  new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);
// Batas paket tercapai; FE memakai kode ini untuk menampilkan ajakan upgrade (FR-42).
export const quotaExceeded = (message: string) => new AppError(403, "QUOTA_EXCEEDED", message);

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound("Endpoint tidak ditemukan"));
};

// Format error tunggal: { error: { code, message, fields? } }
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Input tidak valid",
        fields: zodFields(err),
      },
    });
    return;
  }
  // Error dari express.json(): kesalahan di sisi klien, bukan server.
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Body bukan JSON yang valid" } });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Body terlalu besar" } });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan di server" },
  });
};
