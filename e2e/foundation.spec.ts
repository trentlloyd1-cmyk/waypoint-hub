import { expect, test } from "@playwright/test";
import { expectAccessible, signInAs } from "./helpers";

test.describe("signing in", () => {
  test("the login page is accessible and asks for an email", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expectAccessible(page);
  });

  test("signed-out visitors are sent to login", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page).toHaveURL(/\/login\?next=%2Fcontacts/);
  });

  test("an admin lands on Today", async ({ page }) => {
    await signInAs(page, "Admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    await expectAccessible(page);
  });
});

test.describe("contacts", () => {
  test("add a contact, then find it with Ctrl+K", async ({ page, isMobile }) => {
    await signInAs(page, "Business Development");
    const unique = `Testperson${Date.now().toString().slice(-6)}`;

    await page.getByRole("button", { name: "New" }).click();
    await page.getByRole("menuitem", { name: "Contact" }).click();
    await page.getByLabel(/First name/).fill("Robin");
    await page.getByLabel(/Last name/).fill(unique);
    await page.getByLabel("Mobile").fill("0491 579 455");
    await page.getByRole("button", { name: "Add contact" }).click();

    // The seed data uses this mobile, so we should get the duplicate warning first.
    await expect(page.getByText(/might already be in Waypoint Hub/)).toBeVisible();
    await page.getByRole("button", { name: /add anyway/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: `Robin ${unique}` })).toBeVisible();
    await expectAccessible(page);

    if (!isMobile) {
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox", { name: "Search" }).fill(unique);
      await expect(page.getByRole("option", { name: new RegExp(unique) })).toBeVisible();
    }
  });

  test("log a call on a contact", async ({ page }) => {
    await signInAs(page, "Business Development");
    await page.goto("/contacts?q=hendricks");
    await page.getByRole("link", { name: /Priya Hendricks/ }).first().click();
    await page.getByLabel("Call details").fill("Quick check-in about the footy clinic.");
    await page.getByRole("button", { name: "Log call" }).click();
    await expect(page.getByText("Quick check-in about the footy clinic.")).toBeVisible();
  });

  test("the contacts list is accessible", async ({ page }) => {
    await signInAs(page, "Manager");
    await page.goto("/contacts");
    await expect(page.getByRole("table", { name: "People" })).toBeVisible();
    await expectAccessible(page);
  });
});

test.describe("roles", () => {
  test("support staff can't open contacts", async ({ page }) => {
    await signInAs(page, "Support Staff");
    await page.goto("/contacts");
    await expect(page.getByText(/isn't available for your role/)).toBeVisible();
  });

  test("business development can't export", async ({ page }) => {
    await signInAs(page, "Business Development");
    await page.goto("/contacts");
    await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(0);
    const res = await page.request.get("/api/export/contacts");
    expect(res.status()).toBe(403);
  });

  test("only admins see the Team settings", async ({ page }) => {
    await signInAs(page, "Manager");
    await page.goto("/settings?tab=team");
    await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0);
  });
});
