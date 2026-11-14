import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, platformBillingOverview, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * B2 (audit 2026-11-13): one render error locked the whole panel behind the
 * root crash screen. Now a screen that throws is caught inside the layout:
 * the menu still works, «Home» retries, «Copy for support» carries the
 * details, and no stack trace is on the screen.
 *
 * The crash is a real one from the real bundle: the owner's Home reads
 * `GET /company/{id}/platform-billing`, and an answer without
 * `current_period` makes the debt card throw while rendering.
 * `CRASH_SHOTS=<dir>` also writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const SHOTS = process.env.CRASH_SHOTS;

const COPY = {
  en: { title: "This screen did not open", body: "Everything else works.", home: "Go to Home", copy: "Copy for support", copied: "Copied", menu: "My branches", signIn: "Sign in" },
  ru: { title: "Этот экран не открылся", body: "Остальное работает.", home: "На главную", copy: "Скопировать для поддержки", copied: "Скопировано", menu: "Мои филиалы", signIn: "Вход" },
} as const;

const signInWithBrokenHome = async (page: Page, lang: keyof typeof COPY) => {
  const state = { broken: true };
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/company/1/platform-billing", (r) => r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(state.broken ? { company_id: 1 } : platformBillingOverview(1)),
  }));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: COPY[lang].signIn, exact: true }).click();
  return state;
};

for (const lang of ["en", "ru"] as const) {
  test(`${lang}: a crashing screen keeps the menu, copies details, shows no stack`, async ({ page }) => {
    const c = COPY[lang];
    const state = await signInWithBrokenHome(page, lang);

    await expect(page.getByText(c.title)).toBeVisible();
    await expect(page.getByText(c.body)).toBeVisible();
    // The shell is alive: the side menu and the account card.
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.getByText("Owner One").first()).toBeVisible();
    // No stack trace or raw error on the screen.
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/TypeError|current_period|commission_amount|\bat \w+ \(|\.js:\d+/);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/screen-crash-${lang}.png` });

    // «Copy for support»: the details go to the clipboard.
    await page.getByRole("button", { name: c.copy }).click();
    await expect(page.getByRole("button", { name: c.copied })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/TypeError: .*commission_amount/);
    expect(copied).toContain("Stack:");
    expect(copied).toContain("Route: #/");

    // The side menu leaves the crashed screen.
    await page.locator(".sidebar").getByText(c.menu, { exact: true }).click();
    await expect(page.getByText(c.title)).toHaveCount(0);
    await expect(page).toHaveURL(/#\/branches/);

    // Back on Home with the answer still malformed: caught again, in place.
    await page.goto("/#/");
    await expect(page.getByText(c.title)).toBeVisible();

    // The server answers properly now: «Home» retries and the screen opens.
    state.broken = false;
    await page.getByRole("button", { name: c.home }).click();
    await expect(page.getByText(c.title)).toHaveCount(0);
    await expect(page.locator(".platform-debt")).toBeVisible();
  });
}
