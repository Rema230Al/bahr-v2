import { expect, request, test, type Page } from "@playwright/test";
import { ADMIN, WEB_URL } from "../playwright.config";
import { openView, signOut } from "./admin";

/**
 * Visual check: captures each stop of the dive, the contact form, careers and admin at
 * 390px (phone) and 1440px (desktop). Output: e2e/screens/*.png
 */
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, pin: 5.5 },
  { name: "desktop", width: 1440, height: 900, pin: 6.5 },
];

// Mirrors web/src/lib/journey.ts (and PIN_VH in Dive.tsx): middle of each stop's hold.
const HERO_END = 0.14;
const SEG = (1 - HERO_END) / 4;
const stopAt = (i: number) => HERO_END + i * SEG + SEG * 0.4 + SEG * 0.3;
const SHOTS: [string, number][] = [
  ["0-surface", 0],
  ["0a-stroke-stretch", HERO_END * 0.3],
  ["0b-line-and-plunge", HERO_END * 0.72],
  ["1-agency", stopAt(0)],
  ["2-expertise", stopAt(1)],
  ["2b-blackout", HERO_END + SEG * 1.98],
  ["3-work", stopAt(2)],
  ["4-abyss", stopAt(3)],
];

async function settle(page: Page, ms = 2200) {
  await page.waitForTimeout(ms);
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });

    test(`journey ${vp.name}`, async ({ page }) => {
      test.setTimeout(300_000); // headless WebGL renders on the CPU, which is slow
      await page.goto("/");
      await settle(page, 3200);
      // sweep the pointer across the hero so the contour ripples show
      for (let i = 0; i <= 8; i++) await page.mouse.move(vp.width * (0.2 + i * 0.07), vp.height * (0.55 - i * 0.02));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `screens/${vp.name}-0-ripple.png` });
      for (const [name, p] of SHOTS) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(p * vp.height * vp.pin));
        await settle(page);
        await page.screenshot({ path: `screens/${vp.name}-${name}.png` });
      }
      await page.locator("#contact").scrollIntoViewIfNeeded();
      await settle(page, 1500);
      await page.screenshot({ path: `screens/${vp.name}-5-contact.png` });
      await page.locator("footer").scrollIntoViewIfNeeded();
      await settle(page, 1500);
      await page.screenshot({ path: `screens/${vp.name}-6-finale.png` });
      // back to the surface — everything must reset cleanly
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
      await page.screenshot({ path: `screens/${vp.name}-7-back-to-surface.png` });
    });

    test(`arabic + dark ${vp.name}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.addInitScript(() => localStorage.setItem("bahr:prefs", JSON.stringify({ lang: "ar", theme: "dark" })));
      await page.goto("/");
      await settle(page, 3000);
      await page.screenshot({ path: `screens/${vp.name}-ar-0-hero.png` });
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(stopAt(0) * vp.height * vp.pin));
      await settle(page);
      await page.screenshot({ path: `screens/${vp.name}-ar-1-agency.png` });
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(stopAt(3) * vp.height * vp.pin));
      await settle(page);
      await page.screenshot({ path: `screens/${vp.name}-ar-4-abyss.png` });
    });

    test(`pages ${vp.name}`, async ({ page }) => {
      await page.goto("/careers");
      await settle(page, 1500);
      await page.screenshot({ path: `screens/${vp.name}-careers.png`, fullPage: true });
    });

    test(`admin ${vp.name}`, async ({ page }) => {
      test.setTimeout(180_000);
      await seedAdmin();

      // Sign-in: the only admin screen with the sea, and the form stays above the highest crest
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await settle(page, 1500);
      const sea = await page.locator(".sea-wave").first().boundingBox();
      const form = await page.locator("form").first().boundingBox();
      expect(sea && form).toBeTruthy();
      expect(form!.y + form!.height).toBeLessThan(sea!.y);
      await page.screenshot({ path: `screens/${vp.name}-admin-login.png` });

      await page.getByLabel("Email").fill(ADMIN.email);
      await page.getByLabel("Password").fill(ADMIN.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
      await expect(page.getByTestId("lead").first()).toBeVisible();
      await settle(page, 800);

      // Calm dashboard: no waves; the board never scrolls sideways and Lost is fully on screen
      await expect(page.locator(".sea-wave")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const lost = await page.getByTestId("stage-lost").boundingBox();
      expect(lost!.x + lost!.width).toBeLessThanOrEqual(vp.width);
      await page.screenshot({ path: `screens/${vp.name}-admin-leads.png`, fullPage: true });

      await page.getByTestId("lead").filter({ hasText: "Najd Logistics" }).getByRole("button", { name: /Faisal/ }).click();
      await expect(page.getByRole("dialog")).toContainText("Activity");
      await settle(page, 600);
      await page.screenshot({ path: `screens/${vp.name}-admin-lead-panel.png` });
      await page.getByRole("button", { name: "Close" }).click();

      await page.getByRole("button", { name: "Created: All time" }).click();
      await settle(page, 400);
      await page.screenshot({ path: `screens/${vp.name}-admin-date-menu.png` });
      await page.getByRole("dialog", { name: "Date range" }).getByRole("button", { name: "Last 30 days" }).click();
      await page.getByRole("combobox", { name: "Service", exact: true }).selectOption("ai");
      await settle(page, 600);
      await page.screenshot({ path: `screens/${vp.name}-admin-leads-filtered.png` });
      await page.getByRole("button", { name: "Clear all" }).click();

      await openView(page, "Inquiries");
      await settle(page, 600);
      await page.screenshot({ path: `screens/${vp.name}-admin-inquiries.png`, fullPage: true });

      await openView(page, "Openings");
      await page.getByRole("button", { name: /Senior Motion Designer/ }).click();
      await expect(page.getByTestId("applicant").first()).toBeVisible();
      await settle(page, 600);
      await page.screenshot({ path: `screens/${vp.name}-admin-openings.png`, fullPage: true });

      if (vp.name === "mobile") {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole("button", { name: "Menu" }).click();
        await settle(page, 400);
        await page.screenshot({ path: `screens/${vp.name}-admin-menu.png` });
        await page.getByRole("button", { name: "Menu" }).click();
      }

      // Dark theme, from the sidebar
      await openView(page, "Leads");
      const menu = page.getByRole("button", { name: "Menu" });
      if (await menu.isVisible()) await menu.click();
      await page.getByRole("button", { name: "Dark mode" }).click();
      if (await menu.isVisible()) await menu.click();
      await settle(page, 800);
      await page.screenshot({ path: `screens/${vp.name}-admin-leads-dark.png`, fullPage: true });
      await signOut(page);

      // dark theme + reduced motion: static waves on the sign-in screen
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      const anim = await page.locator(".sea-wave").first().evaluate((el) => getComputedStyle(el).animationName);
      expect(anim).toBe("none");
      await settle(page, 800);
      await page.screenshot({ path: `screens/${vp.name}-admin-login-dark-reduced.png` });
      await page.evaluate(() => localStorage.removeItem("bahr:prefs"));
    });

    test(`reduced motion ${vp.name}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await settle(page, 1000);
      await page.screenshot({ path: `screens/${vp.name}-reduced.png`, fullPage: true });
    });
  });
}

/** Realistic admin data for the screenshots: leads in every stage, owners, values, an opening with applicants. */
let seeded = false;
async function seedAdmin() {
  if (seeded) return;
  seeded = true;
  const api = await request.newContext({ baseURL: WEB_URL, extraHTTPHeaders: { origin: WEB_URL } });
  expect((await api.post("/api/auth/login", { data: ADMIN })).ok()).toBeTruthy();
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString("en-CA");

  const people: [string, string, string, string, string][] = [
    ["Faisal Al-Otaibi", "Najd Logistics", "ai", "150k-500k", "We want an AI assistant for our customer service team, in Arabic and English."],
    ["Reem Al-Qahtani", "Shifa Clinics", "mobile", "150k-500k", "We need a booking app for our clinics across Jeddah and Riyadh."],
    ["Huda Al-Zahrani", "Studio Ruqaa", "web", "50k-150k", "A new site for our design studio, with a case-study library."],
    ["Omar Bakr", "Red Sea Dive Co", "web", "under-50k", "A bilingual landing page for our diving trips."],
    ["Sara Al-Harbi", "Tamr & Co", "mobile", "500k-plus", "A loyalty app for 40 coffee and date shops."],
    ["Khalid Al-Ghamdi", "", "other", "not-sure", "Branding and a small site for a new restaurant concept."],
    ["Lama Hassan", "Waha Realty", "ai", "150k-500k", "Automate lead qualification for our property listings."],
    ["Yousef Nasser", "Atlas Freight", "web", "50k-150k", "Rebuild our customer portal; the old one is slow on phones."],
  ];
  for (const [name, company, service, budget, message] of people) {
    const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
    expect((await api.post("/api/inquiries", { data: { name, email, company, service, budget, message } })).status()).toBe(201);
  }

  const [me] = (await (await api.get("/api/admin/admins")).json()) as { id: number }[];
  const leads = (await (await api.get("/api/admin/leads")).json()) as { id: number; name: string }[];
  const patches: Record<string, object> = {
    "Faisal Al-Otaibi": { stage: "proposal", dealValue: 280000, ownerId: me!.id, followUpOn: daysAgo(-3) },
    "Reem Al-Qahtani": { stage: "contacted", dealValue: 190000, ownerId: me!.id, followUpOn: daysAgo(2) },
    "Huda Al-Zahrani": { stage: "won", dealValue: 95000, ownerId: me!.id },
    "Omar Bakr": { stage: "lost", lostReason: "Went with a freelancer for budget reasons" },
    "Sara Al-Harbi": { stage: "proposal", dealValue: 640000 },
    "Lama Hassan": { stage: "contacted", ownerId: me!.id },
    "Yousef Nasser": { stage: "won", dealValue: 120000, ownerId: me!.id },
  };
  for (const l of leads) {
    const patch = patches[l.name];
    if (patch) expect((await api.patch(`/api/admin/leads/${l.id}`, { data: patch })).ok()).toBeTruthy();
  }
  const faisal = leads.find((l) => l.name === "Faisal Al-Otaibi");
  if (faisal) await api.post(`/api/admin/leads/${faisal.id}/notes`, { data: { body: "Call went well. They want a pilot for the Riyadh branch first." } });

  const opening = (await (
    await api.post("/api/admin/openings", {
      data: { title: "Senior Motion Designer", kind: "job", location: "Jeddah", description: "Bring depth to motion across web and mobile work for our clients." },
    })
  ).json()) as { id: number };
  await api.post("/api/admin/openings", {
    data: { title: "Frontend Engineering Intern", kind: "internship", location: "Remote", description: "Build interfaces with React and WebGL alongside the studio team." },
  });
  const applicants: [string, string, string][] = [
    ["Nora Al-Shehri", "https://nora.design", "Five years of motion work for Saudi brands; I love work that goes below the surface."],
    ["Majed Al-Saud", "https://majed.studio", "I build calm, precise motion systems and would love to grow with Bahr."],
    ["Dana Fares", "https://dribbble.com/danafares", "Motion and 3D generalist; your dive concept is exactly my kind of project."],
  ];
  for (const [name, portfolio, message] of applicants) {
    const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
    await api.post(`/api/openings/${opening.id}/applications`, { data: { name, email, portfolio, message } });
  }
  await api.dispose();
}
