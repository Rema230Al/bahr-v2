import { expect, test } from "@playwright/test";
import { ADMIN } from "../playwright.config";

/** "Help me shape my idea": answer the questions, edit the drafted brief, send it with the form, see it in the admin. */
test("a visitor shapes their idea with the assistant and sends the brief", async ({ page }, testInfo) => {
  // "Depth Co e2e-…" is the marker scripts/cleanup-e2e.ts removes from the live database.
  const company = `Depth Co e2e-brief-${testInfo.project.name}-${Date.now().toString(36)}`;
  await page.goto("/");
  const form = page.locator("#contact form");
  await form.getByLabel("Your name").fill("Huda Al-Shehri");
  await form.getByLabel("Email").fill("huda@example.com");
  await form.getByLabel("Company (optional)").fill(company);
  await form.getByLabel("Tell us about the project").fill("A booking app for our chain of clinics.");

  await form.getByRole("button", { name: /help me shape my idea/i }).click();
  await expect(form.getByLabel("What are you building?")).toHaveValue("A booking app for our chain of clinics.");
  await form.getByRole("button", { name: "Next" }).click();
  await form.getByLabel("Who is it for?").fill("Patients across Jeddah");
  await form.getByRole("button", { name: "Next" }).click();
  await form.getByLabel("What must it do on day one?").fill("Book and reschedule visits");
  await form.getByRole("button", { name: /write my brief/i }).click();

  // No API key in E2E → demo mode returns a sample brief.
  const brief = form.getByLabel("Your project brief");
  await expect(brief).toHaveValue(/Summary[\s\S]*Best-fit Bahr service/);
  await expect(brief).toHaveValue(/Patients across Jeddah/);
  await brief.fill(`${await brief.inputValue()}\nEdited by the client.`);

  await form.getByRole("button", { name: /send inquiry/i }).click();
  await expect(page.getByRole("status")).toContainText("Thank you");

  await page.goto("/admin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: "Leads" }).click();
  await page.getByTestId("lead").filter({ hasText: company }).getByRole("button", { name: /Huda Al-Shehri/ }).click();
  const shown = page.getByRole("dialog").getByTestId("ai-brief");
  await expect(shown).toContainText("Best-fit Bahr service");
  await expect(shown).toContainText("Edited by the client.");
});
