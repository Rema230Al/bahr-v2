import { expect, test, type Page } from "@playwright/test";
import { ADMIN } from "../playwright.config";

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

    test(`admin waves ${vp.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      /** Readability guard: content must end above the highest wave crest (never on the water). */
      const assertClearOfWaves = async (content: string) => {
        const sea = await page.locator(".sea-wave").first().boundingBox();
        const box = await page.locator(content).first().boundingBox();
        expect(sea && box).toBeTruthy();
        expect(box!.y + box!.height).toBeLessThan(sea!.y);
      };

      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await settle(page, 1500);
      await assertClearOfWaves("form");
      await page.screenshot({ path: `screens/${vp.name}-admin-login.png` });

      await page.getByLabel("Email").fill(ADMIN.email);
      await page.getByLabel("Password").fill(ADMIN.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await settle(page, 1200);
      await assertClearOfWaves('[role="tabpanel"]');
      await page.screenshot({ path: `screens/${vp.name}-admin-dashboard.png`, fullPage: true });
      await page.getByRole("tab", { name: "Openings" }).click();
      await settle(page, 1000);
      await assertClearOfWaves('[role="tabpanel"]');
      await page.screenshot({ path: `screens/${vp.name}-admin-openings.png`, fullPage: true });
      await page.getByRole("button", { name: "Sign out" }).click();

      // dark theme + reduced motion: static waves
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => localStorage.setItem("bahr:prefs", JSON.stringify({ lang: "en", theme: "dark" })));
      await page.reload();
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      const anim = await page.locator(".sea-wave").first().evaluate((el) => getComputedStyle(el).animationName);
      expect(anim).toBe("none");
      await settle(page, 800);
      await page.screenshot({ path: `screens/${vp.name}-admin-login-dark-reduced.png` });
    });

    test(`reduced motion ${vp.name}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await settle(page, 1000);
      await page.screenshot({ path: `screens/${vp.name}-reduced.png`, fullPage: true });
    });
  });
}
