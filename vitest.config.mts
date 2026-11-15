import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside a React Server Components bundle; tests run plain Node.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    env: { DATABASE_URL: "file:./test.db", APP_URL: "http://localhost:3000", NODE_ENV: "test" },
    // Integration tests share one SQLite file, so files run one after another.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/actions/**", "src/components/**"],
      reporter: ["text-summary", "html"],
      // UI components are exercised by the Playwright suite; business logic must stay well covered.
      thresholds: {
        lines: 75,
        statements: 75,
        functions: 70,
        branches: 60,
        "src/lib/**": { lines: 90, statements: 88, functions: 90, branches: 75 },
        "src/app/actions/**": { lines: 85, statements: 75, functions: 85, branches: 50 },
      },
    },
  },
});
