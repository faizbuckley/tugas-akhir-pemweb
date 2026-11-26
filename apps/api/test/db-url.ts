import "dotenv/config";

// Test selalu memakai database terpisah berakhiran "_test", karena isinya dihapus setiap test.
export function testDatabaseUrl(): string {
  let raw = process.env.TEST_DATABASE_URL;
  if (!raw) {
    const url = new URL(
      process.env.DATABASE_URL ?? "postgresql://postgres:devpass@localhost:5433/veteran_achieve",
    );
    if (!url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
    raw = url.toString();
  }
  if (!new URL(raw).pathname.endsWith("_test")) {
    throw new Error("Database test harus berakhiran _test");
  }
  return raw;
}
