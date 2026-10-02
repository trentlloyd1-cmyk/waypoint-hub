import { defineConfig } from "vitest/config";

/** Database permission tests. Needs the seeded TEST project in .env.local. */
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 30_000 },
});
