import { expect, test } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * B8 (audit 2026-11-13, panel part): with no connection to the server the
 * sign-in card and its reset face showed the browser's own English
 * «Failed to fetch». On the real bundle, with the request really failing at
 * the network level: our sentence, in the chosen language, re-said on a
 * language switch. `LOGIN_SHOTS=<dir>` also writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const SHOTS = process.env.LOGIN_SHOTS;
const RU = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
const EN = "No connection to the server. Check your internet and try again.";
const AM = "Սերվերի հետ կապ չկա։ Ստուգեք ինտերնետը և նորից փորձեք։";

test.beforeEach(async ({ page }) => {
  await seedLanguageChosen(page, "ru");
  await installBackendMocks(page);
  for (const path of ["/session/login", "/forgot-password"]) {
    await page.route((u) => isBackend(u) && u.pathname === path, (r) => r.abort("internetdisconnected"));
  }
  await page.goto("/");
});

test("sign-in with no connection: our sentence, never «Failed to fetch»", async ({ page }) => {
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  await expect(page.getByText(RU)).toBeVisible();
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/login-offline-ru.png` });

  await page.locator(".login-lang-pill", { hasText: "ENG" }).click();
  await expect(page.getByText(EN)).toBeVisible();
  await page.locator(".login-lang-pill", { hasText: "ՀԱՅ" }).click();
  await expect(page.getByText(AM)).toBeVisible();
});

test("password reset with no connection: our sentence, never «Failed to fetch»", async ({ page }) => {
  await page.locator(".login-flip > form button.login-flip-back").click();
  const back = page.locator(".login-flip-face-back");
  await back.locator("input[type='email']").fill("op@club.am");
  await back.locator("button[type='submit'], button:not([type])").first().click();
  await expect(back.getByText(RU)).toBeVisible();
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/forgot-offline-ru.png` });
});
