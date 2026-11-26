// Dimuat sebelum file test (--import), jadi env sudah siap saat src/lib/env.ts dibaca.
import { testDatabaseUrl } from "./db-url.js";

process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_SECRET = "rahasia-khusus-test-bukan-produksi";
process.env.JWT_EXPIRES_IN = "1h";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.NODE_ENV = "test";
