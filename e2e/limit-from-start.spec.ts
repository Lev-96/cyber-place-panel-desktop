import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, signIn, type Lang } from "./helpers/moneySession";

/**
 * «Задать время» on an unlimited seat (2026-11-15, owner — production seat
 * #258: "1 hour" set ten seconds after a 1000/h start ran from the press, and
 * the hour banked 1100). The dialog offers the SERVER's two answers,
 * «Всего с начала места · до HH:MM» (chosen by default) and «Ещё 1 ч от
 * сейчас · до HH:MM», each with the seat's time in all; the confirm sends the
 * choice as `from`, and the toast says the server's end and figure.
 * Figures as `SessionLimitTest` computes them: ten seconds played, the hour in
 * all 1000.00, from now 1002.78.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/limit-from-start-2026-11-15/panel");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400); // let the dialog's entrance finish
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

const START: Record<Lang, string> = { en: "In all from the seat's start", ru: "Всего с начала места", am: "Ընդամենը տեղի սկզբից" };
const NOW: Record<Lang, string> = { en: "1 h more from now", ru: "Ещё 1 ч от сейчас", am: "Եվս 1 ժ այս պահից" };
const UNTIL: Record<Lang, string> = { en: "until", ru: "до", am: "մինչև" };
const TOTAL_1000: Record<Lang, RegExp> = {
  en: /Seat time in all: 1,?000/, ru: /За время места всего: 1[\s,.]?000/, am: /Տեղի ժամանակի համար ընդամենը՝ 1[\s,.]?000/,
};
const TOTAL_1002: Record<Lang, RegExp> = {
  en: /Seat time in all: 1,?002\.78/, ru: /За время места всего: 1[\s,.]?002[.,]78/, am: /Տեղի ժամանակի համար ընդամենը՝ 1[\s,.]?002[.,]78/,
};
const DONE_START: Record<Lang, RegExp> = {
  en: /Until \d\d:\d\d: seat time in all 1,?000/, ru: /До \d\d:\d\d: за всё время места 1[\s,.]?000/,
  am: /Մինչև \d\d:\d\d՝ տեղի ամբողջ ժամանակի համար 1[\s,.]?000/,
};
const DONE_NOW: Record<Lang, RegExp> = {
  en: /Until \d\d:\d\d: 1 h more, seat time in all 1,?002\.78/, ru: /До \d\d:\d\d: ещё 1 ч, за всё время места 1[\s,.]?002[.,]78/,
  am: /Մինչև \d\d:\d\d՝ եվս 1 ժ, տեղի ամբողջ ժամանակի համար 1[\s,.]?002[.,]78/,
};
const LONGER = "The player has already played longer: 1 h 10 min. Choose a longer time, or count it from now.";

/** Seat #258's shape: count-up at 1000/h, ten seconds in. */
const started = () => Date.now() - 10_000;

const plan = (from: "start" | "now", startedAt: number, played = 10) => from === "start"
  ? { from, minutes: 60, played_seconds: played, hourly_rate: 1000, ends_at: new Date(startedAt + 3_600_000).toISOString(), time_total: 1000, charge: 997.22 }
  : { from, minutes: 60, played_seconds: played, hourly_rate: 1000, ends_at: new Date(startedAt + played * 1000 + 3_600_000).toISOString(), time_total: 1002.78, charge: 1000 };

const quote = (startedAt: number, longer = false) => ({
  minutes: 60, hourly_rate: 1000, played_seconds: longer ? 4200 : 10,
  start: longer ? { available: false, from: "start", message: LONGER } : { available: true, ...plan("start", startedAt) },
  now: { available: true, ...plan("now", startedAt, longer ? 4200 : 10) },
});

/** Routes are registered AFTER sign-in: the catch-all mock registered there would otherwise win. */
const open = async (page: Page, lang: Lang, width: number, startedAt: number, longer: boolean, sent: { body: unknown }) => {
  await signIn(page, lang, width);
  await seedBoard(page, { session: () => runningSession({ started_at: new Date(startedAt).toISOString() }) });
  await page.route((u) => at("/sessions/5/limit-quote")(u), (r) => r.fulfill(json(quote(startedAt, longer))));
  await page.route(at("/sessions/5/limit"), (r) => {
    const body = r.request().postDataJSON() as { from: "start" | "now" };
    sent.body = body;
    const p = plan(body.from, startedAt, longer ? 4200 : 10);
    return r.fulfill(json({
      session: runningSession({ mode: "fixed", is_unlimited: false, ends_at: p.ends_at, started_at: new Date(startedAt).toISOString() }),
      hourly_now: { seat: 1000, pads: 0, extras: 0, total: 1000 },
      limit: p,
    }));
  });
  await openBoard(page);
  await page.locator('[data-action="add-time"]').first().click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
  await page.getByTestId("limit-duration-hours").fill("1");
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`in all from the start by default: the server's end and 1000, «from» sent (${lang}, ${width})`, async ({ page }) => {
      const startedAt = started();
      const sent = { body: null as unknown };
      await open(page, lang, width, startedAt, false, sent);

      const startCard = page.getByTestId("limit-from-start");
      const nowCard = page.getByTestId("limit-from-now");
      await expect(startCard).toContainText(START[lang]);
      await expect(startCard).toContainText(`${UNTIL[lang]} ${clock(startedAt + 3_600_000)}`);
      await expect(startCard).toContainText(TOTAL_1000[lang]);
      await expect(startCard.getByRole("radio")).toBeChecked();
      await expect(nowCard).toContainText(NOW[lang]);
      await expect(nowCard).toContainText(TOTAL_1002[lang]);
      await expect(nowCard.getByRole("radio")).not.toBeChecked();

      await page.getByTestId("limit-section").scrollIntoViewIfNeeded();
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=limit-section]");
      await shot(page, `limit-choice-${lang}-${width}`);

      await page.getByTestId("limit-confirm").click();
      await expect.poll(() => sent.body).toEqual({ minutes: 60, from: "start" });
      await expect(page.getByText(DONE_START[lang]).first()).toBeVisible();
      await shot(page, `limit-toast-start-${lang}-${width}`);
    });

    test(`more from now when chosen: «now» sent, the server's 1002.78 toasted (${lang}, ${width})`, async ({ page }) => {
      const startedAt = started();
      const sent = { body: null as unknown };
      await open(page, lang, width, startedAt, false, sent);

      await page.getByTestId("limit-from-now").click();
      await expect(page.getByTestId("limit-from-now").getByRole("radio")).toBeChecked();
      await page.getByTestId("limit-confirm").click();
      await expect.poll(() => sent.body).toEqual({ minutes: 60, from: "now" });
      await expect(page.getByText(DONE_NOW[lang]).first()).toBeVisible();
    });

    test(`played longer than «in all»: the server's sentence, nothing sent until «from now» (${lang}, ${width})`, async ({ page }) => {
      const startedAt = Date.now() - 70 * 60_000;
      const sent = { body: null as unknown };
      await open(page, lang, width, startedAt, true, sent);

      const startCard = page.getByTestId("limit-from-start");
      await expect(startCard).toContainText(LONGER);
      await expect(startCard.getByRole("radio")).toBeDisabled();
      await expect(page.getByTestId("limit-confirm")).toBeDisabled();
      await fitsWidth(page, "[data-testid=limit-section]");
      await shot(page, `limit-longer-${lang}-${width}`);

      await page.getByTestId("limit-from-now").click();
      await expect(page.getByTestId("limit-confirm")).toBeEnabled();
      await page.getByTestId("limit-confirm").click();
      await expect.poll(() => sent.body).toEqual({ minutes: 60, from: "now" });
    });
  }
}
