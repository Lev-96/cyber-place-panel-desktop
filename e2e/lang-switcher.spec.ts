import { expect, test } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Language preference must persist across reloads. Tests the
 * `keyValueStore.set(KEY_LANG, ...)` round-trip the LanguageContext
 * does on every `setLang` call.
 */

test("Russian selection survives a reload", async ({ page }) => {
  await installBackendMocks(page);
  await page.goto("/");

  // Default English — the sign-in button reads "Sign in".
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  // Switch to Russian via the pill.
  await page.locator(".login-lang-pill", { hasText: "РУС" }).click();
  await expect(page.getByRole("button", { name: "Вход" })).toBeVisible();

  // Reload — pill state must restore from localStorage.
  await page.reload();
  await expect(page.getByRole("button", { name: "Вход" })).toBeVisible();
});

test("Armenian selection localises form labels", async ({ page }) => {
  await installBackendMocks(page);
  await page.goto("/");

  await page.locator(".login-lang-pill", { hasText: "ՀԱՅ" }).click();
  await expect(page.getByRole("button", { name: "Մուտք" })).toBeVisible();
});
