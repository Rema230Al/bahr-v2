import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { ADMIN, WEB_URL } from "../playwright.config";
import { openView } from "./admin";

/**
 * The three core journeys, end to end through the real UI, Vite proxy, Elysia API and SQLite:
 *  1. a visitor sends a project inquiry
 *  2. a visitor applies to an opening (and can't apply twice)
 *  3. the admin logs in, sees both, and accepts the applicant — which closes the opening
 */
test.describe.configure({ mode: "serial" });

// Unique per project run (desktop + mobile share one database).
let openingTitle = "";
const applicant = { name: "Lama Hassan", email: "" };
const inquirer = { name: "Faisal Al-Otaibi", company: "" };

let admin: APIRequestContext;

test.beforeAll(async ({}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`;
  openingTitle = `Motion Designer ${run}`;
  applicant.email = `lama-${run}@example.com`;
  inquirer.company = `Depth Co ${run}`;

  // The admin posts the opening through the API (the UI path for this is covered in test 3).
  admin = await request.newContext({ baseURL: WEB_URL, extraHTTPHeaders: { origin: WEB_URL } });
  const login = await admin.post("/api/auth/login", { data: ADMIN });
  expect(login.ok()).toBeTruthy();
  const res = await admin.post("/api/admin/openings", {
    data: { title: openingTitle, kind: "job", location: "Jeddah", description: "Bring depth to motion across web and mobile work." },
  });
  expect(res.status()).toBe(201);
});

test.afterAll(async () => admin?.dispose());

test("a visitor sends a project inquiry from the abyss", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/deeper/i);

  const form = page.locator("#contact form");
  await form.getByLabel("Your name").fill(inquirer.name);
  await form.getByLabel("Email").fill("faisal@example.com");
  await form.getByLabel("Company (optional)").fill(inquirer.company);
  await form.getByLabel("What do you need?").selectOption("ai");
  await form.getByLabel("Budget (SAR)").selectOption("150k-500k");

  // client-side validation first
  await form.getByLabel("Tell us about the project").fill("short");
  await form.getByRole("button", { name: /send inquiry/i }).click();
  await expect(form.getByText("At least 10 characters")).toBeVisible();

  await form.getByLabel("Tell us about the project").fill("We want an AI assistant for our customer service team.");
  await form.getByRole("button", { name: /send inquiry/i }).click();
  await expect(page.getByRole("status")).toContainText("Thank you");
});

test("a visitor applies to an opening, and can't apply twice with the same email", async ({ page }) => {
  await page.goto("/careers");
  const row = page.getByTestId("opening").filter({ hasText: openingTitle });
  await row.getByRole("button", { expanded: false }).click();

  const fillAndSend = async (email: string) => {
    const form = row.getByRole("form");
    await form.getByLabel("Full name").fill(applicant.name);
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Portfolio link").fill("https://lama.design");
    await form.getByLabel("Why Bahr?").fill("I love work that goes below the surface.");
    await form.getByRole("button", { name: /send application/i }).click();
  };

  await fillAndSend(applicant.email);
  await expect(row.getByRole("status")).toContainText("Application received");

  // Same email again (different case) → the server refuses the duplicate
  await page.reload();
  await row.getByRole("button", { expanded: false }).click();
  await fillAndSend(applicant.email.toUpperCase());
  await expect(row.getByRole("alert")).toContainText("already applied");
});

test("the admin logs in, reviews, and accepts the applicant — the opening closes", async ({ page }) => {
  // Admin routes are refused without a session
  const anon = await request.newContext({ baseURL: WEB_URL });
  expect((await anon.get("/api/admin/inquiries")).status()).toBe(401);
  await anon.dispose();

  await page.goto("/admin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Wrong email or password");

  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();

  // The inquiry from test 1 is there
  await openView(page, "Inquiries");
  await expect(page.getByTestId("inquiry").filter({ hasText: inquirer.company })).toBeVisible();

  // Open the opening, find the applicant, accept (two-step confirm)
  await openView(page, "Openings");
  await page.getByRole("button", { name: new RegExp(openingTitle) }).click();
  const card = page.getByTestId("applicant").filter({ hasText: applicant.email });
  await card.getByRole("button", { name: `Accept ${applicant.name}` }).click();
  await card.getByRole("button", { name: "Confirm accept" }).click();

  await expect(card).toContainText(/accepted/i);
  await expect(page.getByRole("button", { name: new RegExp(openingTitle) })).toContainText(/closed/i);

  // Publicly, the opening now shows as filled and takes no applications
  await page.goto("/careers");
  const row = page.getByTestId("opening").filter({ hasText: openingTitle });
  await expect(row).toContainText(/Filled/);
  await row.getByRole("button").first().click();
  await expect(row.getByText("This opening has been filled.")).toBeVisible();
  await expect(row.getByRole("form")).toHaveCount(0);
});
