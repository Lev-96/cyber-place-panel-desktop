import { expect, test } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Login flow: covers two long-asked-for behaviours:
 *   1. Wrong creds show a localised "Неверный логин или пароль" error,
 *      derived from HTTP 422 with no `message` body. Catches the regression
 *      where users would see "HTTP 422" instead of a friendly string.
 *   2. Switching language while the error is displayed re-translates the
 *      error itself (not just the form labels). Validates the
 *      `LoginErr.kind` discriminator pattern stays in place.
 */

test.beforeEach(async ({ page }) => {
  await installBackendMocks(page);
  await page.goto("/");
});

test("wrong credentials show a friendly localised error", async ({ page }) => {
  await page.getByPlaceholder("your@email.com").fill("a@a.com");
  await page.getByPlaceholder(/•/).fill("wrong");
  // Default lang is en — error should be the English variant.
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".error")).toHaveText(/Wrong email or password/);
});

test("error message follows the language switcher", async ({ page }) => {
  await page.getByPlaceholder("your@email.com").fill("a@a.com");
  await page.getByPlaceholder(/•/).fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".error")).toHaveText(/Wrong email or password/);

  // Switch to Russian via the lang pill — the existing error text should
  // re-render in the new language without re-submitting the form.
  await page.getByRole("button", { name: "Russian" }).or(page.locator(".login-lang-pill", { hasText: "РУС" })).click();
  await expect(page.locator(".error")).toHaveText(/Неверный логин или пароль/);
});

test("right credentials land on Home with the user name", async ({ page }) => {
  await page.getByPlaceholder("your@email.com").fill("a@a.com");
  await page.getByPlaceholder(/•/).fill("correct");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Name appears in both the sidebar footer and the Home GradientText —
  // assert specifically against the gradient one.
  await expect(page.locator(".gradient-text", { hasText: "Test User" })).toBeVisible();
});
