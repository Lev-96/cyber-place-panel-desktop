import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANGS, WIDTHS, fitsWidth, json, signIn, type Lang } from "./helpers/moneySession";

/**
 * "A new desktop version is out" (2026-11-20, owner: a manager never noticed
 * a release; the server's notice was a bell row only). In a real browser, in
 * en/ru/am, at a desk (1280) and the desktop's smallest window (520):
 *
 *  - the corner card says the version, the section and its button in the
 *    panel's language (never the row's stored English sentence);
 *  - «Открыть Обновление» opens «Обновление», marks the waiting notices read,
 *    and the screen's own button carries the name the card used;
 *  - «Позже» hides it without reading it;
 *  - the bell's row says the same;
 *  - nothing when this desktop already runs that version.
 *
 * The desktop bridge (`window.cyberplaceUpdates`, the Electron preload) is
 * stubbed: the card is desktop-only. Rows are `PanelUpdateAvailable` as the
 * backend writes them (`NotifyStaffOfPanelUpdate`).
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/update-notice-2026-11-20/panel");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const row = (id: string, version: string) => ({
  id,
  type: `A new Cyber Place version ${version} is ready: open «Updates»`,
  read_at: null,
  created_at: new Date().toISOString(),
  data: { type: "app_update.available", app: "panel", version, mandatory: false },
});

const TEXT: Record<Lang, { title: string; body: string; open: string; later: string; check: string }> = {
  en: { title: "New Cyber Place version 1.0.68", body: "Open the «Updates» section and press «Check for updates».", open: "Open Updates", later: "Later", check: "Check for updates" },
  ru: { title: "Новая версия Cyber Place 1.0.68", body: "Откройте раздел «Обновление» и нажмите «Проверить обновления».", open: "Открыть Обновление", later: "Позже", check: "Проверить обновления" },
  am: { title: "Cyber Place-ի նոր տարբերակ՝ 1.0.68", body: "Բացեք «Թարմացում» բաժինը և սեղմեք «Ստուգել թարմացումները»։", open: "Բացել Թարմացումը", later: "Ավելի ուշ", check: "Ստուգել թարմացումները" },
};

/** The Electron preload's update bridge, as `electron/preload.ts` exposes it, on a desktop running `installed`. */
const stubDesktop = async (page: Page, installed: string) => {
  await page.addInitScript((version) => {
    const state = { status: "not-available", currentVersion: version, availableVersion: null, progressPercent: null, notes: null, error: null };
    Object.defineProperty(window, "cyberplaceUpdates", {
      configurable: true,
      value: {
        check: async () => state,
        checkGated: async () => state,
        install: async () => {},
        getState: async () => state,
        onState: () => () => {},
      },
    });
  }, installed);
};

const open = async (page: Page, lang: Lang, width: number, installed = "1.0.66") => {
  const reads: string[] = [];
  await stubDesktop(page, installed);
  await signIn(page, lang, width, "manager", async () => {
    const rows = [row("n-68", "1.0.68"), row("n-67", "1.0.67")];
    await page.route((u) => u.hostname !== "localhost" && u.pathname === "/notifications", (r) => r.fulfill(json({
      data: rows, meta: { current_page: 1, last_page: 1, per_page: 50, total: 2, unread_count: 2 },
    })));
    await page.route((u) => u.hostname !== "localhost" && u.pathname === "/notifications/unread-count", (r) => r.fulfill(json({ unread_count: 2 })));
    await page.route((u) => u.hostname !== "localhost" && /^\/notifications\/.+\/read$/.test(u.pathname), (r) => {
      reads.push(new URL(r.request().url()).pathname);
      return r.fulfill(json({ id: "x", read_at: new Date().toISOString() }));
    });
  });
  return reads;
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`the card: version, where to go, what to press; «Открыть Обновление» goes there (${lang}, ${width})`, async ({ page }) => {
      const reads = await open(page, lang, width);
      const card = page.getByTestId("panel-update-card");
      await expect(card).toBeVisible();
      await expect(card).toContainText(TEXT[lang].title);
      await expect(card).toContainText(TEXT[lang].body);
      await expect(card).not.toContainText("is ready: open");
      await expect(page.getByTestId("panel-update-open")).toHaveText(TEXT[lang].open);
      await expect(page.getByTestId("panel-update-later")).toHaveText(TEXT[lang].later);
      await fitsWidth(page, "[data-testid=panel-update-card]");
      await shot(page, `card-${lang}-${width}`);

      await page.getByTestId("panel-update-open").click();
      await expect(page).toHaveURL(/#\/settings\/agent-updates$/);
      await expect(card).toHaveCount(0);
      await expect.poll(() => [...reads].sort()).toEqual(["/notifications/n-67/read", "/notifications/n-68/read"]);
      // The button the card named is the one on the screen.
      await expect(page.getByTestId("desktop-update-check")).toHaveText(TEXT[lang].check);
      await shot(page, `updates-${lang}-${width}`);
    });

    test(`«Позже» hides it without reading it; the bell says the same (${lang}, ${width})`, async ({ page }) => {
      const reads = await open(page, lang, width);
      await page.getByTestId("panel-update-later").click();
      await expect(page.getByTestId("panel-update-card")).toHaveCount(0);

      await page.goto("/#/notifications");
      await expect(page.getByText(TEXT[lang].title)).toBeVisible();
      await expect(page.getByText(TEXT[lang].body).first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText("is ready: open");
      expect(reads).toEqual([]);
      await shot(page, `bell-${lang}-${width}`);
    });
  }
}

test("nothing when this desktop already runs the announced version", async ({ page }) => {
  await open(page, "ru", 1280, "1.0.68");
  await page.waitForTimeout(800);
  await expect(page.getByTestId("panel-update-card")).toHaveCount(0);
});
