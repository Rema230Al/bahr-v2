import { expect, request, test } from "@playwright/test";
import { WEB_URL } from "../playwright.config";
import { openView, signIn } from "./admin";

/** Leads CRM: a "Let's talk" inquiry shows up as a lead in New, and dragging it to Won sticks. */

// Tall enough that the whole board is on screen, so the drag needs no scrolling.
test.use({ viewport: { width: 1440, height: 1400 } });

test("the admin drags a lead from New to Won", async ({ page }, testInfo) => {
  // "Depth Co e2e-…" is the marker scripts/cleanup-e2e.ts removes from the live database.
  const company = `Depth Co e2e-leads-${testInfo.project.name}-${Date.now().toString(36)}`;
  const visitor = await request.newContext({ baseURL: WEB_URL });
  const sent = await visitor.post("/api/inquiries", {
    data: { name: "Reem Al-Qahtani", email: "reem@example.com", company, service: "mobile", budget: "150k-500k", message: "We need a booking app for our clinics." },
  });
  expect(sent.status()).toBe(201);
  await visitor.dispose();

  await signIn(page); // Leads is the first view

  const newCol = page.getByTestId("stage-new");
  const wonCol = page.getByTestId("stage-won");
  const card = newCol.getByTestId("lead").filter({ hasText: company });
  await expect(card).toBeVisible();

  await card.dragTo(wonCol);
  await expect(wonCol.getByTestId("lead").filter({ hasText: company })).toBeVisible();
  await expect(newCol.getByTestId("lead").filter({ hasText: company })).toHaveCount(0);

  // Saved on the server, not just moved on screen
  await page.reload();
  await openView(page, "Leads");
  const won = page.getByTestId("stage-won").getByTestId("lead").filter({ hasText: company });
  await expect(won).toBeVisible();
  await won.getByRole("button", { name: /Reem Al-Qahtani/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Moved from New to Won");
});
