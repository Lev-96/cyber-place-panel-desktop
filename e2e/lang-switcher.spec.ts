import { expect, test } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

// NOTE: `exact: true` matters here. Playwright's `name` is a case-insensitive
// SUBSTRING match by default, and the forgot-password panel that shipped later
// carries a "Back to sign in" button — so the plain locator resolves to two
// elements and strict mode fails the click. Pinning the exact name is what
// keeps this about the submit button.
/**
 * Language preference must persist across reloads. Tests the
 * `keyValueStore.set(KEY_LANG, ...)` round-trip the LanguageContext
 * does on every `setLang` call.
 */

test("Russian selection survives a reload", async ({ page }) => {
  await installBackendMocks(page);
  await page.goto("/");

  // Default English — the sign-in button reads "Sign in".
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

  // Switch to Russian via the pill.
  await page.locator(".login-lang-pill", { hasText: "РУС" }).click();
  await expect(page.getByRole("button", { name: "Вход", exact: true })).toBeVisible();

  // Reload — pill state must restore from localStorage.
  await page.reload();
  await expect(page.getByRole("button", { name: "Вход", exact: true })).toBeVisible();
});

test("Armenian selection localises form labels", async ({ page }) => {
  await installBackendMocks(page);
  await page.goto("/");

  await page.locator(".login-lang-pill", { hasText: "ՀԱՅ" }).click();
  await expect(page.getByRole("button", { name: "Մուտք", exact: true })).toBeVisible();
});
