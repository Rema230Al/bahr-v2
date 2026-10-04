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

/**
 * Layout guard: every card stays inside its own column at every board width (stacked phone,
 * 3 columns, the tightest 5-column width, wide desktop), and long text truncates instead of
 * pushing the card wider.
 */
test("lead cards stay inside their column, and long text truncates", async ({ page }, testInfo) => {
  // "Depth Co e2e-…" is the marker scripts/cleanup-e2e.ts removes from the live database.
  const company = `Depth Co e2e-wide-${testInfo.project.name}-${Date.now().toString(36)} International Holding Company for Trading and Contracting`;
  const visitor = await request.newContext({ baseURL: WEB_URL });
  const sent = await visitor.post("/api/inquiries", {
    data: {
      name: "Abdulrahman Mohammed Al-Abdulkarim Al-Qahtani",
      email: "abdulrahman.mohammed.alabdulkarim@a-very-long-company-domain.example.com",
      company,
      service: "mobile",
      budget: "500k-plus",
      message: "A booking platform for every clinic we run across the kingdom.",
    },
  });
  expect(sent.status()).toBe(201);
  await visitor.dispose();

  await signIn(page);
  const card = page.getByTestId("lead").filter({ hasText: "International Holding" });
  await expect(card).toBeVisible();

  for (const width of [390, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1400 });
    await expect(card).toBeVisible();

    const problems = await page.evaluate(() => {
      const out: string[] = [];
      for (const col of document.querySelectorAll<HTMLElement>('[data-testid^="stage-"]')) {
        const c = col.getBoundingClientRect();
        for (const li of col.querySelectorAll<HTMLElement>('[data-testid="lead"]')) {
          const r = li.getBoundingClientRect();
          const inner = li.firstElementChild as HTMLElement;
          if (r.left < c.left - 0.5 || r.right > c.right + 0.5) out.push(`${col.dataset.testid}: card ${Math.round(r.left)}–${Math.round(r.right)} outside column ${Math.round(c.left)}–${Math.round(c.right)}`);
          if (inner.scrollWidth > inner.clientWidth + 1) out.push(`${col.dataset.testid}: card content ${inner.scrollWidth}px wider than card ${inner.clientWidth}px`);
        }
      }
      if (document.documentElement.scrollWidth > window.innerWidth) out.push("page scrolls sideways");
      return out;
    });
    expect(problems, `at ${width}px`).toEqual([]);

    // The long company name is cut with an ellipsis, not wrapped or overflowing.
    const companyLine = card.getByText(company);
    const cut = await companyLine.evaluate((el) => ({ truncated: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow }));
    expect(cut, `at ${width}px`).toEqual({ truncated: true, ellipsis: "ellipsis" });
  }
});
