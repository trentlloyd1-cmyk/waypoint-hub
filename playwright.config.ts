import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They run against the TEST Supabase project with seeded fake data,
 * signing in through the development-only test login.
 *   npm run seed        (once)
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // One at a time: two tests signing in as the same test user at once cancel each other's sign-in link.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "en-AU",
    timezoneId: "Australia/Brisbane",
  },
  projects: [
    // Uses the Microsoft Edge already on Windows, so there's no extra browser to download.
    // On CI (Linux) it falls back to Playwright's own Chromium.
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "msedge" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "msedge" } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
