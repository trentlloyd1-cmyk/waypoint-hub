import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    // Database permission tests live in tests/ and run separately: npm run test:rls
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
