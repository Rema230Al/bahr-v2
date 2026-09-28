import { expect, request, test } from "@playwright/test";
import { ADMIN, WEB_URL } from "../playwright.config";

/** Admin date range: a range hides items outside it, is kept across tabs, and Clear brings everything back. */
test("the admin filters the dashboard by a date range", async ({ page }, testInfo) => {
  // "Depth Co e2e-…" is the marker scripts/cleanup-e2e.ts removes from the live database.
  const company = `Depth Co e2e-dates-${testInfo.project.name}-${Date.now().toString(36)}`;
  const visitor = await request.newContext({ baseURL: WEB_URL });
  const sent = await visitor.post("/api/inquiries", {
    data: { name: "Huda Al-Zahrani", email: "huda@example.com", company, service: "web", budget: "50k-150k", message: "A new site for our design studio." },
  });
  expect(sent.status()).toBe(201);
  await visitor.dispose();

  await page.goto("/admin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  const inquiry = page.getByTestId("inquiry").filter({ hasText: company });
  const range = page.getByRole("group", { name: "Date range" });
  await expect(inquiry).toBeVisible();

  // A custom range in the past: today's inquiry is filtered out on the server
  await range.getByLabel("From").fill("2020-12-15");
  await range.getByLabel("To", { exact: true }).fill("2021-01-20");
  await expect(range.getByLabel("Created")).toHaveValue("custom");
  await expect(range.getByRole("status")).toContainText("15 Dec 2020 – 20 Jan 2021");
  await expect(page.getByText("No inquiries in this date range.")).toBeVisible();
  await expect(inquiry).toHaveCount(0);

  // "To" before "From" is refused
  await range.getByLabel("To", { exact: true }).fill("2020-12-01");
  await expect(range.getByRole("alert")).toContainText("can't be before");
  await range.getByLabel("To", { exact: true }).fill("2021-01-20");

  // The range is kept on the Leads tab, and the column counts follow it
  await page.getByRole("tab", { name: "Leads" }).click();
  await expect(range.getByLabel("From")).toHaveValue("2020-12-15");
  await expect(page.getByTestId("stage-new").locator("header")).toContainText("0");
  await expect(page.getByTestId("lead").filter({ hasText: company })).toHaveCount(0);

  // "Today" includes it again
  await range.getByLabel("Created").selectOption("today");
  await expect(page.getByTestId("stage-new").getByTestId("lead").filter({ hasText: company })).toBeVisible();

  // Back on Inquiries the preset is still applied; Clear resets to all dates
  await page.getByRole("tab", { name: "Inquiries" }).click();
  await expect(range.getByLabel("Created")).toHaveValue("today");
  await expect(inquiry).toBeVisible();
  await range.getByRole("button", { name: "Clear dates" }).click();
  await expect(range.getByLabel("Created")).toHaveValue("all");
  await expect(range.getByLabel("From")).toHaveValue("");
  await expect(range.getByRole("status")).toContainText("Showing all dates");
});
