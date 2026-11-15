import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fmt, t } from "../src/i18n/translations";
import { LANGS, WIDTHS, json, signIn, type Lang } from "./helpers/moneySession";

/**
 * The shift report's «Остатки» (v6, 2026-11-16). The fixture is the backend's
 * OWN answer for the evening of `ShiftReportStockTest` (dumped from
 * `GET /shifts/{id}/summary`), so the table is checked against the server's
 * real shape and figures: per product start / received / sold / returned /
 * recount / left, the totals row, below zero in red and named. A report from
 * before v6 shows no table. en/ru/am × 1280/520: the table scrolls in its own
 * viewport, the page never does; no raw key, no em dash.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/history-filter-split-stock-2026-11-15/stock");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
};
const isBackend = (u: URL) => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
const SUMMARY = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/shift-stock-v6-summary.json"), "utf8")) as {
  shift: Record<string, unknown>;
  report: Record<string, unknown> & { stock?: unknown };
};
const MINUS = "−";

/**
 * Nothing of «Остатки» sticks out of the window: the section and everything
 * in it, the table's cells excepted (they scroll in the table's own viewport,
 * which itself must fit). Scoped to the section on purpose: at 520px the
 * report's header buttons and its «По способам оплаты» card already stick out
 * on the pre-stock report, identically with and without this table (measured
 * 2026-11-16; reported, not this change's to fix).
 */
const noOverflow = async (page: Page) => {
  const wide = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const section = document.querySelector<HTMLElement>("[data-testid=shift-stock]")!;
    return [section, ...Array.from(section.querySelectorAll<HTMLElement>("*"))]
      .filter((el) => !el.parentElement?.closest(".hs-scroll"))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; })
      .map((el) => `${el.tagName}.${el.className}`).slice(0, 5);
  });
  expect(wide).toEqual([]);
};

const openShift = async (page: Page, lang: Lang, width: number, report: Record<string, unknown>) => {
  await signIn(page, lang, width);
  await page.route((u) => isBackend(u) && u.pathname === "/shifts/current", (r) => r.fulfill(json({ shift: SUMMARY.shift, report })));
  await page.route((u) => isBackend(u) && u.pathname === "/shifts", (r) => r.fulfill(json({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } })));
  await page.route((u) => isBackend(u) && u.pathname === "/shifts/staff", (r) => r.fulfill(json({ data: [] })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => r.fulfill(json({ branch: { id: 1, address: "Abovyan 1", city: "Yerevan", company_id: 1 } })));
  await page.goto("/#/branches/1/shift");
  await expect(page.getByTestId("shift-report")).toBeVisible();
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`shift report: «Остатки» as the server counted them (${lang}, ${width})`, async ({ page }) => {
      await openShift(page, lang, width, SUMMARY.report);

      const section = page.getByTestId("shift-stock");
      await expect(section).toBeVisible();
      await expect(section.locator("h3")).toHaveText(t("shift.stock", lang));
      await expect(section).toContainText(t("shift.stockRule", lang));
      await expect(section.locator("thead th")).toHaveText(
        ["product", "start", "received", "sold", "returned", "corrected", "remaining"].map((k) => t(`shift.stock.${k}`, lang)),
      );

      const rows = page.getByTestId("shift-stock-row");
      await expect(rows.locator("th")).toHaveText(["Chips", "Cola", "Juice", "Lemonade"]);
      await expect(rows.nth(0).locator("td")).toHaveText(["5", "0", "9", "2", `${MINUS}1`, `${MINUS}3`]);
      await expect(rows.nth(1).locator("td")).toHaveText(["20", "12", "8", "4", "0", "28"]);
      await expect(rows.nth(2).locator("td")).toHaveText(["7", "0", "0", "0", "0", "7"]);
      await expect(rows.nth(3).locator("td")).toHaveText([t("shift.stock.notCounted", lang), "10", "1", "0", "0", "9"]);
      await expect(page.getByTestId("shift-stock-total").locator("td")).toHaveText(["32", "22", "18", "6", `${MINUS}1`, "41"]);
      await expect(page.getByTestId("shift-stock-remaining").first()).toHaveClass(/is-negative/);
      await expect(page.getByTestId("shift-stock-negative")).toHaveText(fmt(t("shift.stock.negative", lang), `Chips ${MINUS}3`));

      // The money blocks are the report's own, untouched beside it.
      await expect(page.getByTestId("shift-products")).toBeVisible();

      await section.scrollIntoViewIfNeeded();
      const region = section.getByRole("region", { name: t("shift.stock", lang) });
      const box = await region.boundingBox();
      const vw = await page.evaluate(() => document.documentElement.clientWidth);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
      await noOverflow(page);
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/\b(shift|stock)\.[a-z][A-Za-z_.]+/);
      expect(text).not.toContain("—");
      await section.screenshot({ path: path.join(SHOTS, `shift-stock-${lang}-${width}.png`) });
      await shot(page, `shift-stock-page-${lang}-${width}`);
    });
  }
}

test("a report from before v6 shows no «Остатки» (ru, 1280)", async ({ page }) => {
  const { stock: _drop, ...v5 } = SUMMARY.report;
  await openShift(page, "ru", 1280, { ...v5, version: 5 });
  await expect(page.getByTestId("shift-products")).toBeVisible();
  await expect(page.getByTestId("shift-stock")).toHaveCount(0);
});
