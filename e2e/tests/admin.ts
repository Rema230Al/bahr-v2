import { expect, type Page } from "@playwright/test";
import { ADMIN } from "../playwright.config";

/** Shared admin steps. Not a spec file: playwright.config only matches *.spec.ts. */

export async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
}

/** Picks a view in the sidebar. On phones the sidebar is a menu, so open it first. */
export async function openView(page: Page, name: "Leads" | "Inquiries" | "Openings") {
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Admin" }).getByRole("button", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

export async function signOut(page: Page) {
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Sign out" }).click();
}
