import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET minimal 16 karakter"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ALLOWED_EMAIL_DOMAIN: z.string().default("mahasiswa.upnvj.ac.id"),
  // Dibuat opsional dulu sampai modul auth dan pembayaran dikerjakan; ketatkan setelahnya.
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_CALLBACK_URL: z
    .string()
    .default("http://localhost:4000/api/auth/google/callback"),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  MIDTRANS_SERVER_KEY: z.string().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Konfigurasi .env tidak valid:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
