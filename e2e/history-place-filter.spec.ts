import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANGS, WIDTHS, at, json, noRawKeys, owner, runningSession, signIn, type Lang } from "./helpers/moneySession";

/**
 * Sessions → History, «Место» (2026-11-15): the place select sits after the
 * staff picker, fits the bar at 1280 and at the 520px window in every
 * language (a long seat name is cut by the select, never the bar), and a
 * picked place travels as `place_id` on the sessions list and the events feed.
 * While a place is picked, the till sales and bookings step aside with one
 * muted line.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/history-filter-split-stock-2026-11-15/history");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
};

const LONG = "Большой VIP-зал у окна с двумя телевизорами и диваном";
const places = [
  { id: 12, branch_id: 1, number: 2, name: "Corner", type: "standard", status: "active", platform: "ps5" },
  { id: 11, branch_id: 1, number: 1, name: LONG, type: "vip", status: "active", platform: "ps5" },
  { id: 13, branch_id: 1, number: 3, name: null, type: "standard", status: "active", platform: "ps5" },
];

const closed = runningSession({
  id: 5, status: "stopped", mode: "open", is_unlimited: false, ends_at: new Date().toISOString(),
  stopped_at: new Date().toISOString(), total_paid: 1000, payment_method: "cash",
});

const TEXT: Record<Lang, { label: string; all: string; hides: string }> = {
  en: { label: "Seat", all: "All seats", hides: "Sales without a seat and bookings are hidden while a seat is picked." },
  ru: { label: "Место", all: "Все места", hides: "Продажи без места и брони скрыты, пока выбрано место." },
  am: { label: "Տեղ", all: "Բոլոր տեղերը", hides: "Առանց տեղի վաճառքներն ու ամրագրումները թաքցված են, քանի դեռ տեղ է ընտրված։" },
};

const openHistory = async (page: Page, lang: Lang, width: number) => {
  const reads: URL[] = [];
  await signIn(page, lang, width);
  await page.route(at("/places"), (r) => r.fulfill(json({ data: places, meta: { total: places.length } })));
  await page.route(at("/sessions"), (r) => { reads.push(new URL(r.request().url())); return r.fulfill(json({ data: [closed] })); });
  await page.route(at("/session-events"), (r) => { reads.push(new URL(r.request().url())); return r.fulfill(json({ data: [] })); });
  await page.route(at("/session-events/actors"), (r) => r.fulfill(json({ data: [owner] })));
  await page.route(at("/sessions/5/events"), (r) => r.fulfill(json({ data: [] })));
  await page.goto("/#/branches/1/sessions/history");
  await expect(page.getByTestId("history-place")).toBeVisible();
  await expect(page.getByTestId("history-place").locator("option")).toHaveCount(4);
  return reads;
};

/** No element of the page sticks out to the right, and the page itself does not scroll sideways. */
const noOverflow = async (page: Page) => {
  const out = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = Array.from(document.querySelectorAll<HTMLElement>("main *"))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; })
      .map((el) => `${el.tagName}.${el.className}`).slice(0, 5);
    return { wide, page: document.documentElement.scrollWidth - vw };
  });
  expect(out.wide).toEqual([]);
  expect(out.page).toBeLessThanOrEqual(0);
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`history: place filter fits and is sent (${lang}, ${width})`, async ({ page }) => {
      const reads = await openHistory(page, lang, width);
      const select = page.getByTestId("history-place");

      // Label and «all», in the language; after the staff picker.
      await expect(select.locator("xpath=..")).toContainText(TEXT[lang].label);
      await expect(select.locator("option").first()).toHaveText(TEXT[lang].all);
      const order = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll("main select"));
        return all.indexOf(document.querySelector("[data-testid=history-place]") as Element) - 1;
      });
      expect(order).toBeGreaterThanOrEqual(0);
      await expect(select.locator("option")).toHaveText([TEXT[lang].all, `№1 · ${LONG}`, "№2 · Corner", "№3"]);

      // Without a place: no place_id anywhere, till and bookings on the page.
      expect(reads.some((u) => u.searchParams.has("place_id"))).toBe(false);
      await expect(page.getByTestId("till-history")).toBeVisible();
      await expect(page.getByTestId("booking-history")).toBeVisible();

      await select.selectOption("11");
      await expect(select).toHaveAttribute("title", `№1 · ${LONG}`);
      await expect.poll(() => reads.filter((u) => u.searchParams.get("place_id") === "11").map((u) => u.pathname).sort())
        .toEqual(["/session-events", "/sessions"]);
      await expect(page.getByTestId("till-history")).toHaveCount(0);
      await expect(page.getByTestId("booking-history")).toHaveCount(0);
      const hides = page.getByText(TEXT[lang].hides);
      await expect(hides).toBeVisible();
      await expect(hides).toHaveClass(/muted/);

      // The select is capped and inside the window; its long line is cut by it.
      const box = await select.boundingBox();
      const vw = await page.evaluate(() => document.documentElement.clientWidth);
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(260 + 0.5);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
      await noOverflow(page);
      await noRawKeys(page, "main");
      await shot(page, `history-place-${lang}-${width}`);

      // Back to every place: the page as it always was.
      await select.selectOption("");
      await expect(page.getByTestId("till-history")).toBeVisible();
      await expect(page.getByTestId("booking-history")).toBeVisible();
    });
  }
}
