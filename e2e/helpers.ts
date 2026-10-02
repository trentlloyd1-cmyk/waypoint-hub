import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export type TestRole = "Admin" | "Manager" | "Business Development" | "Support Staff";

/** Signs in through the development-only test login panel. */
export async function signInAs(page: Page, role: TestRole) {
  await page.goto("/login");
  await page.getByRole("region", { name: /test mode/i }).getByRole("button", { name: new RegExp(`^${role}`) }).click();
  await page.waitForURL("**/today");
  // Close the first-login tour if it appears.
  const skip = page.getByRole("button", { name: /skip the tour|let's go/i });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

/** Fails the test on any WCAG 2.2 A/AA accessibility violation. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(summary, summary.join("\n")).toEqual([]);
}
