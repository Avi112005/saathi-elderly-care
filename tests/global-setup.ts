import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Creates a fresh, throwaway SQLite database for the integration tests. The file lives
 * next to the schema (prisma/test.db) and is never the development database.
 */
export default function setup() {
  const file = path.resolve(__dirname, "../prisma/test.db");
  for (const f of [file, `${file}-journal`]) rmSync(f, { force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
