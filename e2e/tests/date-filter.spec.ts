import { expect, request, test } from "@playwright/test";
import { WEB_URL } from "../playwright.config";
import { openView, signIn } from "./admin";

/**
 * Admin filter bar: a date range hides items outside it and is kept across views; search and
 * the Stage dropdown narrow the list; every active filter is a chip that removes it.
 */
test("the admin filters the dashboard by a date range", async ({ page }, testInfo) => {
  // "Depth Co e2e-…" is the marker scripts/cleanup-e2e.ts removes from the live database.
  const company = `Depth Co e2e-dates-${testInfo.project.name}-${Date.now().toString(36)}`;
  const visitor = await request.newContext({ baseURL: WEB_URL });
  const sent = await visitor.post("/api/inquiries", {
    data: { name: "Huda Al-Zahrani", email: "huda@example.com", company, service: "web", budget: "50k-150k", message: "A new site for our design studio." },
  });
  expect(sent.status()).toBe(201);
  await visitor.dispose();

  await signIn(page);
  await openView(page, "Inquiries");

  const inquiry = page.getByTestId("inquiry").filter({ hasText: company });
  const dates = page.getByRole("button", { name: /^Created:/ });
  const menu = page.getByRole("dialog", { name: "Date range" });
  const chips = page.getByRole("list", { name: "Active filters" });
  await expect(inquiry).toBeVisible();

  // Search narrows the list and shows as a chip
  await page.getByRole("searchbox").fill(company);
  await expect(chips).toContainText(company);
  await expect(page.getByTestId("inquiry")).toHaveCount(1);
  await chips.getByRole("button", { name: /^Remove filter “/ }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");

  // A custom range in the past: today's inquiry is filtered out on the server
  await dates.click();
  await menu.getByLabel("From").fill("2020-12-15");
  await menu.getByLabel("To", { exact: true }).fill("2021-01-20");
  await expect(menu.getByRole("button", { name: "Custom range" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("No inquiries in this date range.")).toBeVisible();
  await expect(inquiry).toHaveCount(0);

  // "To" before "From" is refused
  await menu.getByLabel("To", { exact: true }).fill("2020-12-01");
  await expect(menu.getByRole("alert")).toContainText("can't be before");
  await menu.getByLabel("To", { exact: true }).fill("2021-01-20");
  await menu.getByRole("button", { name: "Done" }).click();
  await expect(menu).toHaveCount(0);
  await expect(chips).toContainText("Created: 15 Dec 2020 – 20 Jan 2021");

  // The range is kept on Leads, and the stats and column counts follow it
  await openView(page, "Leads");
  await expect(chips).toContainText("15 Dec 2020 – 20 Jan 2021");
  await expect(page.getByTestId("stage-new").locator("header")).toContainText("0");
  await expect(page.getByLabel("Summary")).toContainText(/Total leads\s*0/);
  await expect(page.getByTestId("lead").filter({ hasText: company })).toHaveCount(0);

  // "Today" includes it again
  await dates.click();
  await menu.getByRole("button", { name: "Today" }).click();
  const lead = page.getByTestId("stage-new").getByTestId("lead").filter({ hasText: company });
  await expect(lead).toBeVisible();

  // The Stage dropdown hides it; removing that chip brings it back
  await page.getByRole("combobox", { name: "Stage", exact: true }).selectOption("won");
  await expect(chips).toContainText("Stage: Won");
  await expect(lead).toHaveCount(0);
  await chips.getByRole("button", { name: "Remove filter Stage: Won" }).click();
  await expect(lead).toBeVisible();

  // Back on Inquiries the preset is still applied; removing its chip resets to all dates
  await openView(page, "Inquiries");
  await expect(chips).toContainText("Created: Today");
  await expect(inquiry).toBeVisible();
  await chips.getByRole("button", { name: "Remove filter Created: Today" }).click();
  await expect(dates).toContainText("All time");
  await expect(page.getByTestId("filter-chip")).toHaveCount(0);
});
