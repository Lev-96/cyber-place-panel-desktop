import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * B6 (audit 2026-11-13): Active Places cards (and the «Интерфейс» preview)
 * printed the raw `place.type`, «STANDARD», in ru/am. On the real bundle: the
 * tier is the dictionary's word in every language. `TIER_SHOTS=<dir>` also
 * writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.TIER_SHOTS;
type Lang = "en" | "ru" | "am";
const WORDS: Record<Lang, { standard: string; vip: string; signIn: string }> = {
  en: { standard: "Standard", vip: "VIP", signIn: "Sign in" },
  ru: { standard: "Стандарт", vip: "VIP", signIn: "Вход" },
  am: { standard: "Ստանդարտ", vip: "VIP", signIn: "Մուտք" },
};

const seat = (n: number, type: "standard" | "vip") => ({
  id: n, branch_id: 1, place_id: 100 + n, label: `PC ${n}`, kind: "pc", status: "online", is_startable: true,
  hourly_rate: 1200, assigned_hourly_rate: 1200, current_session_id: null,
  place: { id: 100 + n, number: n, name: `Hall ${n}`, type, platform: "pc" },
});

const signIn = async (page: Page, lang: Lang) => {
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [seat(1, "standard"), seat(2, "vip")] })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => r.fulfill(json({
    branch: { id: 1, name: "Hall", company_id: 1, price_for_branch: { id: 1, branch_id: 1, "pc-standard": 1000, "pc-vip": 1200 } },
  })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: WORDS[lang].signIn, exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
};

const tierLines = (page: Page, scope: string) =>
  page.locator(`${scope} .place-cell .platform`).evaluateAll((els) => els.map((e) => e.textContent ?? ""));

for (const lang of ["en", "ru", "am"] as const) {
  test(`${lang}: Active Places cards say the tier in the dictionary's word`, async ({ page }) => {
    await signIn(page, lang);
    await page.goto("/#/branches/1/sessions");
    await expect(page.locator(".place-cell .platform").first()).toBeVisible();
    const lines = await tierLines(page, "");
    expect(lines.join(" | ")).not.toMatch(/\bstandard\b|\bvip\b/);
    expect(lines.some((l) => l.includes(WORDS[lang].standard))).toBe(true);
    expect(lines.some((l) => l.includes(WORDS[lang].vip))).toBe(true);
    if (SHOTS) await page.locator(".place-cell").first().screenshot({ path: `${SHOTS}/tier-board-${lang}.png` });
  });
}

test("ru: the /appearance preview says the tier in Russian too", async ({ page }) => {
  await signIn(page, "ru");
  await page.goto("/#/appearance");
  const preview = page.locator(".place-cell .platform").first();
  await expect(preview).toBeVisible();
  const lines = await tierLines(page, "");
  expect(lines.join(" | ")).not.toMatch(/STANDARD|\bstandard\b/);
  expect(lines.some((l) => l.includes("Стандарт"))).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tier-appearance-ru.png` });
});
