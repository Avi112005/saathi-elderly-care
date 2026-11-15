import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import type { TestProject } from "vitest/node";

const root = path.resolve(__dirname, "..");

function prisma(args: string[], databaseUrl: string) {
  execFileSync(process.execPath, [path.join(root, "scripts", "prisma.mjs"), ...args], {
    stdio: "ignore",
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}

/**
 * Creates a fresh, throwaway database for the integration tests:
 *  - SQLite (default): prisma/test.db, deleted and recreated — never the dev database.
 *  - PostgreSQL (TEST_DATABASE_URL set): a brand-new schema named for this run.
 * For PostgreSQL the client is generated for that provider and the local SQLite client
 * is restored afterwards.
 */
export default function setup(project?: TestProject) {
  // Global setup runs in the main process, which doesn't receive `test.env` — read it from the config.
  const url = project?.config.env?.DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./test.db";
  if (url.startsWith("file:")) {
    const file = path.join(root, "prisma", "test.db");
    for (const f of [file, `${file}-journal`]) rmSync(f, { force: true });
    prisma(["db", "push", "--skip-generate"], url);
    return undefined;
  }
  prisma(["db", "push"], url);
  return () => prisma(["generate"], "file:./saathi.db");
}
