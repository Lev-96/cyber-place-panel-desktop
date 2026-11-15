import { expect, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installBackendMocks, seedLanguageChosen } from "./mockBackend";

/**
 * Shared by the money/session feature specs (2026-11-15: start by amount,
 * unpaid lines, change at Stop, keep the rate, reminders, the history renders).
 * Every fixture mirrors the backend's own feature tests
 * (`tests/Feature/Session{StartByAmount,ItemUnpaid,PrepaidChange,
 * UnlimitedKeepRate,Reminder}Test.php`): money in resources as numbers,
 * money in audit meta as decimal strings.
 */

export type Lang = "en" | "ru" | "am";
export const LANGS: Lang[] = ["en", "ru", "am"];
/**
 * 1280: an ordinary desk; 520: the desktop's smallest window
 * (`electron/windowBounds.ts`). Phones (390) are the owner web's own shell
 * (top bar, no side menu), not this bundle's: measured in that app, not here.
 */
export const WIDTHS = [1280, 520] as const;
const SIGN_IN: Record<Lang, string> = { en: "Sign in", ru: "Вход", am: "Մուտք" };
const CONFIRM: Record<Lang, string> = { en: "Confirm", ru: "Подтвердить", am: "Հաստատել" };

/** Answer the in-app ConfirmDialog (never a native confirm) with its own button. */
export const confirmInApp = async (page: Page, lang: Lang) => {
  await page.getByRole("button", { name: CONFIRM[lang], exact: true }).last().click();
};

export const isBackend = (u: URL): boolean => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
export const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
export const at = (path: string) => (u: URL) => isBackend(u) && u.pathname === path;

/** Where the screenshots go (the report folder of this task). */
export const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/money-session-features-2026-11-15/panel");
export const shot = async (page: Page, name: string, target?: { screenshot: (o: { path: string }) => Promise<unknown> }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${name}.png`);
  await page.waitForTimeout(400); // let a dialog's entrance finish
  await (target ?? page).screenshot({ path: file });
};

export const owner = { id: 1, name: "Owner One", role: "company_owner" };

/** The board's seat: a PS5 at №3 with an assigned rate of 1000/h. */
export const pc = (n: number, sessionId: number | null) => ({
  id: n, branch_id: 1, place_id: 10 + n, label: `PS5 ${n}`, kind: "ps", status: "online", is_startable: true,
  hourly_rate: 1000, assigned_hourly_rate: 1000, current_session_id: sessionId,
  place: { id: 10 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "ps5" },
});

/** A running session as `SessionResource` answers it (the fields the board reads). */
export const runningSession = (over: Record<string, unknown> = {}) => ({
  id: 5, branch_id: 1, pc_id: 3, pc_label: "PS5 3", user_display_name: "Арам", mode: "open", status: "active",
  started_at: new Date(Date.now() - 30 * 60_000).toISOString(), ends_at: null, hourly_rate: 1000, tariff_hourly_rate: 1000,
  total_paid: 0, is_free: false, is_unlimited: true, supports_joysticks: true, place_platform: "ps5",
  joystick_count: 1, joysticks: [], items: [], prepaid_amount: null, cash_received: null, cash_change: null,
  reminder: null, unpaid_items_total: 0, unpaid_since: null, unpaid_amount: null,
  ...over,
});

export interface BoardOpts {
  lang?: Lang;
  width?: number;
  role?: "company_owner" | "manager";
  sessions?: () => Record<string, unknown>[];
  pcs?: Record<string, unknown>[];
}

/** Sign in as the owner of branch 1 in a language, at a width. */
export const signIn = async (
  page: Page, lang: Lang = "en", width = 1280, role: "company_owner" | "manager" = "company_owner",
  /** Routes the app reads AT sign-in (the notifications feed): registered before it. */
  setup?: () => Promise<void>,
) => {
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role, company_id: 1, branch_id: 1, name: "Owner One" });
  if (setup) await setup();
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o.com");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: SIGN_IN[lang], exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
};

/** The board with one running seat (№3) and one free one (№4). */
export const seedBoard = async (page: Page, opts: BoardOpts & { session?: () => Record<string, unknown> }) => {
  const sessions = opts.sessions ?? (() => (opts.session ? [opts.session()] : []));
  await page.route(at("/pcs"), (r: Route) => r.fulfill(json({ data: opts.pcs ?? [pc(3, 5), pc(4, null)] })));
  await page.route(at("/sessions"), (r: Route) => (r.request().method() === "GET" ? r.fulfill(json({ data: sessions() })) : r.fallback()));
  await page.route(at("/branches/1"), (r: Route) => r.fulfill(json({
    branch: { id: 1, name: "Hall", company_id: 1, price_for_branch: { id: 1, branch_id: 1, "ps5-standard": 1000 } },
  })));
};

export const openBoard = async (page: Page) => {
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".place-cell").first()).toBeVisible();
};

/** Nothing in the page may print a raw dictionary key or an em dash. */
export const noRawKeys = async (page: Page, scope = "body") => {
  const text = await page.locator(scope).first().innerText();
  expect(text).not.toMatch(/\b(history|session|shift|time|reminder)\.[a-z][A-Za-z_.]+/);
  expect(text).not.toContain("—");
};

/** Nothing in `selector` is wider than the viewport (no horizontal overflow). */
export const fitsWidth = async (page: Page, selector: string) => {
  const over = await page.evaluate((sel) => {
    const vw = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>(`${sel}, ${sel} *`))
      .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > vw + 1)
      .map((el) => `${el.tagName}.${el.className}: ${(el.textContent ?? "").slice(0, 40)} (${Math.round(el.getBoundingClientRect().right)} > ${vw})`).slice(0, 5);
  }, selector);
  expect(over).toEqual([]);
};
