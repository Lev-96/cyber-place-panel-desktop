import { expect, test } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

// NOTE: `exact: true` matters here. Playwright's `name` is a case-insensitive
// SUBSTRING match by default, and the forgot-password panel that shipped later
// carries a "Back to sign in" button — so the plain locator resolves to two
// elements and strict mode fails the click. Pinning the exact name is what
// keeps this about the submit button.
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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error")).toHaveText(/Wrong email or password/);
});

test("error message follows the language switcher", async ({ page }) => {
  await page.getByPlaceholder("your@email.com").fill("a@a.com");
  await page.getByPlaceholder(/•/).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error")).toHaveText(/Wrong email or password/);

  // Switch to Russian via the lang pill — the existing error text should
  // re-render in the new language without re-submitting the form.
  await page.getByRole("button", { name: "Russian" }).or(page.locator(".login-lang-pill", { hasText: "РУС" })).click();
  await expect(page.locator(".error")).toHaveText(/Неверный логин или пароль/);
});

test("right credentials land on Home with the user name", async ({ page }) => {
  await page.getByPlaceholder("your@email.com").fill("a@a.com");
  await page.getByPlaceholder(/•/).fill("correct");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Name appears in both the sidebar footer and the Home GradientText —
  // assert specifically against the gradient one.
  await expect(page.locator(".gradient-text", { hasText: "Test User" })).toBeVisible();
});

/**
 * «Forgot password?» turns the card over in 3D (the owner asked for the turn
 * back on 2026-11-13; it is the only motion on the sign-in). jsdom runs no
 * transitions, so only a real browser can prove the two things that matter:
 * the card actually turns over time, and focus lands in the reverse face's
 * field on the same click (a face still `visibility: hidden` cannot be focused).
 */
test("forgot password turns the card over and focuses its field", async ({ page }) => {
  const flip = page.locator(".login-flip");
  await page.locator(".login-flip > form button.login-flip-back").click();

  const angles: number[] = [];
  for (let i = 0; i < 12; i++) {
    angles.push(await flip.evaluate((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return Math.round((Math.atan2(-m.m13, m.m11) * 180) / Math.PI);
    }));
    await page.waitForTimeout(40);
  }
  // Somewhere strictly between flat and turned: a turn, not a swap.
  expect(angles.some((a) => Math.abs(a) > 10 && Math.abs(a) < 170)).toBe(true);

  await expect(flip).toHaveClass(/is-back/);
  await expect(page.locator(".login-flip-face-back input[type='email']")).toBeFocused();
  await expect(page.locator(".login-flip > form.login-card")).toHaveCSS("visibility", "hidden");

  await page.locator(".login-flip-face-back button.login-flip-back").click();
  await expect(page.locator(".login-flip > form.login-card input[type='email']")).toBeFocused();
});
