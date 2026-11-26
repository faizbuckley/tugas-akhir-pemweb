// Membuat database test (bila belum ada) dan menerapkan semua migrasi.
import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./db-url.js";

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
});
