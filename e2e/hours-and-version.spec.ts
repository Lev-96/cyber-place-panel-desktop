import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * Owner, 2026-11-14, in the browser build (the bundle the owner web vendors):
 *  1. Branch → «Часы работы»: a save says so with the standard green toast,
 *     once, and a refused save does not.
 *  2. The dialog fits with no scroll, inside or around it, at 1280×720 and at
 *     the desktop's smallest window (520×560, `electron/windowBounds.ts`), in
 *     every language, with every hint showing.
 *  3. The app version is the DESKTOP app's: a browser shows none, on the
 *     sign-in or in the side menu (the Electron half is in
 *     `e2e-electron/shell.spec.ts`).
 *
 * `CP_SHOTS_DIR` set: screenshots of each case are written there.
 */

const isBackend = (u: URL) => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
const SHOTS = process.env.CP_SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

type Lang = "en" | "ru" | "am";
const SIGN_IN: Record<Lang, string> = { en: "Sign in", ru: "Вход", am: "Մուտք" };
const HOURS: Record<Lang, string> = { en: "Working hours", ru: "Часы работы", am: "Աշխատանքային ժամեր" };
const SAVE: Record<Lang, string> = { en: "Save", ru: "Сохранить", am: "Պահպանել" };
const SAVED: Record<Lang, string> = { en: "Working hours saved", ru: "Часы работы сохранены", am: "Աշխատանքային ժամերը պահպանվեցին" };

/**
 * The week with the most to show: every kind of row (same day, overnight,
 * 24 hours from the open, around the clock, a day off), each hint present.
 */
const MIXED = [
  { day_of_week: 1, start_time: "10:00:00", end_time: "23:00:00" },
  { day_of_week: 2, start_time: "10:00:00", end_time: "23:00:00" },
  { day_of_week: 3, start_time: "10:00:00", end_time: "02:40:00" },
  { day_of_week: 4, start_time: "12:00:00", end_time: "00:00:00" },
  { day_of_week: 5, start_time: "10:00:00", end_time: "10:00:00" },
  { day_of_week: 6, start_time: "00:00:00", end_time: "00:00:00" },
];
/** Seven days of the longest hint («24 hours, until 10:00 next day»): the tallest the rows get. */
const LONGEST = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day_of_week: d, start_time: "10:00:00", end_time: "10:00:00" }));

const open = async (page: Page, lang: Lang, days = MIXED, size = { width: 1280, height: 720 }) => {
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "admin", name: "Admin One" });
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ branch: {
        id: 1, company_id: 1, city: "Yerevan", country: "Armenia",
        address: "Yerevan, Abovyan street 5, building 2", address_lat: 40.18, address_lng: 44.5,
        phone: "+374 77 123456", branch_logo_path: "", status: "active", ratings_avg_rating: null,
        places_count: 12, days_of_weeks: days,
      } }),
    });
  });
  // The edit page's PIN card reads its own route; `{data: []}` has no `pin`.
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1/unlock-pin", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: { pin: null } }),
  }));
  await page.setViewportSize(size);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("a@a.com");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: SIGN_IN[lang], exact: true }).click();
  await expect(page.locator("aside.sidebar")).toBeVisible();
  await page.goto("/#/branches/1/edit");
  await page.getByRole("button", { name: HOURS[lang], exact: true }).click();
  await expect(page.locator("form.open-days")).toBeVisible();
  // The dialog's entrance has played.
  await page.waitForTimeout(400);
};

/** Overflow of every box that could scroll: the overlay, the dialog card, the page. */
const overflow = (page: Page) => page.evaluate(() => {
  const over = (el: Element | null) => (el ? el.scrollHeight - el.clientHeight : -1);
  const card = document.querySelector("form.open-days") as HTMLElement;
  const r = card.getBoundingClientRect();
  return {
    overlay: over(document.querySelector(".cp-modal")),
    card: over(card),
    list: over(document.querySelector(".open-days__list")),
    page: over(document.scrollingElement),
    sideways: (document.querySelector(".cp-modal") as HTMLElement).scrollWidth - (document.querySelector(".cp-modal") as HTMLElement).clientWidth,
    inView: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
    cardHeight: Math.round(r.height),
  };
});

const expectNoScroll = async (page: Page) => {
  const o = await overflow(page);
  expect(o, JSON.stringify(o)).toMatchObject({ overlay: 0, card: 0, list: 0, page: 0, sideways: 0, inView: true });
  return o;
};

test.describe("working hours: no scroll", () => {
  for (const lang of ["en", "ru", "am"] as const) {
    for (const size of [{ width: 1280, height: 720 }, { width: 520, height: 560 }]) {
      test(`${size.width}×${size.height}, ${lang}: every function on screen, nothing scrolls`, async ({ page }) => {
        await open(page, lang, MIXED, size);
        const o = await expectNoScroll(page);
        test.info().annotations.push({ type: "card height", description: `${o.cardHeight}px of ${size.height}` });

        // Every function is there: 7 switches, the times of the 6 open days,
        // «apply to all» on each, the hints, the tracks, the summary.
        const form = page.locator("form.open-days");
        await expect(form.getByRole("switch")).toHaveCount(7);
        await expect(form.getByRole("textbox")).toHaveCount(12);
        await expect(form.locator(".open-day__copy")).toHaveCount(6);
        await expect(form.getByTestId("open-day-hint")).toHaveCount(3);
        await expect(form.locator(".open-day__track")).toHaveCount(6);
        await expect(form.getByTestId("open-days-summary")).toBeVisible();
        for (const el of await form.locator(".open-day__copy, .open-day__track, [data-testid='open-day-hint'], .btn").all()) {
          await expect(el).toBeInViewport({ ratio: 1 });
        }
        await shot(page, `hours-${size.width}x${size.height}-${lang}`);
      });
    }
    test(`520×560, ${lang}: seven days of the longest hint still fit`, async ({ page }) => {
      await open(page, lang, LONGEST, { width: 520, height: 560 });
      await expectNoScroll(page);
      await shot(page, `hours-520x560-${lang}-longest`);
    });
  }

  /**
   * A phone (the owner web's size; this bundle's dialog CSS is what it vendors).
   * Two lines per open day there, 40px targets. A scroll would be allowed on a
   * phone, but at 390×844 it fits (measured 2026-11-14: card 652 / 667 / 688px
   * in en / ru / am), so that is held too; sideways never.
   */
  for (const lang of ["en", "ru", "am"] as const) {
    test(`390×844, ${lang}: fits with no scroll, nothing sideways`, async ({ page }) => {
      await open(page, lang, MIXED, { width: 390, height: 844 });
      const o = await overflow(page);
      test.info().annotations.push({ type: "phone", description: `${lang}: card ${o.cardHeight}px, overlay overflow ${o.overlay}px` });
      expect(o, JSON.stringify(o)).toMatchObject({ overlay: 0, card: 0, list: 0, page: 0, sideways: 0, inView: true });
      await shot(page, `hours-390x844-${lang}`);
    });
  }

  test("the times line up from Monday to Sunday, and so do the tracks", async ({ page }) => {
    await open(page, "am", MIXED, { width: 520, height: 560 });
    const xs = await page.$$eval(".open-day[data-open]", (rows) => rows.map((r) => ({
      time: Math.round((r.querySelector(".open-day__time") as HTMLElement).getBoundingClientRect().left),
      track: Math.round((r.querySelector(".open-day__track") as HTMLElement).getBoundingClientRect().left),
      trackW: Math.round((r.querySelector(".open-day__track") as HTMLElement).getBoundingClientRect().width),
    })));
    expect(new Set(xs.map((x) => x.time)).size).toBe(1);
    expect(new Set(xs.map((x) => x.track)).size).toBe(1);
    expect(new Set(xs.map((x) => x.trackW)).size).toBe(1);
    expect(xs[0].trackW).toBeGreaterThan(60);
  });

  test("a refused save marks the field and still fits at 1280×720", async ({ page }) => {
    await open(page, "ru", MIXED);
    await page.route((u) => isBackend(u) && u.pathname === "/branches/1" && u.searchParams.get("_method") === "PUT", (r) => r.fulfill({
      status: 422, contentType: "application/json",
      body: JSON.stringify({
        message: "The days_of_weeks.0.start_time field must match the format H:i.",
        errors: { "days_of_weeks.0.start_time": ["The days_of_weeks.0.start_time field must match the format H:i."] },
      }),
    }));
    await page.getByRole("button", { name: SAVE.ru, exact: true }).click();
    await expect(page.locator(".open-days__error")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Пн, Открытие" })).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".cp-toast-success")).toHaveCount(0);
    await expectNoScroll(page);
    await shot(page, "hours-1280x720-ru-refused");
  });
});

test.describe("working hours: the «saved» toast", () => {
  for (const lang of ["en", "ru", "am"] as const) {
    test(`${lang}: one green toast after a save, and the dialog closes`, async ({ page }) => {
      await open(page, lang);
      let puts = 0;
      await page.route((u) => isBackend(u) && u.pathname === "/branches/1" && u.searchParams.get("_method") === "PUT", (r) => {
        puts++;
        return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
      });
      await page.getByRole("button", { name: SAVE[lang], exact: true }).click();
      const toast = page.locator(".cp-toast-success");
      await expect(toast).toHaveCount(1);
      await expect(toast).toHaveText(new RegExp(SAVED[lang]));
      await expect(page.locator("form.open-days")).toHaveCount(0);
      expect(puts).toBe(1);
      await shot(page, `hours-toast-${lang}`);
      // Still exactly one a moment later: nothing raises a second.
      await page.waitForTimeout(600);
      await expect(page.locator(".cp-toast-success")).toHaveCount(1);
    });
  }

  test("every day switched off: the guard speaks, no request, no toast", async ({ page }) => {
    await open(page, "en");
    let puts = 0;
    await page.route((u) => isBackend(u) && u.pathname === "/branches/1" && u.searchParams.get("_method") === "PUT", (r) => {
      puts++;
      return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    // Clicked the way a person does, on the day's label; one at a time, as each turns off.
    const on = page.locator("form.open-days .cp-switch[data-checked]");
    while (await on.count() > 0) await on.first().click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".open-days__error")).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.locator(".cp-toast")).toHaveCount(0);
    expect(puts).toBe(0);
  });
});

test.describe("the version is the desktop app's alone", () => {
  test("a browser shows no version on the sign-in or in the side menu", async ({ page }) => {
    await installBackendMocks(page, { role: "admin", name: "Admin One" });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.locator(".login-stage")).toBeVisible();
    await expect(page.locator(".login-version")).toHaveCount(0);
    await expect(page.locator(".login-stage")).not.toContainText(/Version|\d+\.\d+\.\d+/);
    // The order the owner set: mark, wordmark, title, card.
    expect(await page.$$eval(".login-stage > *", (els) => els.map((e) => e.className.split(" ")[0]))).toEqual(
      ["login-logo", "login-brand", "login-title", "login-flip-wrap"],
    );
    await shot(page, "web-login-1280x720-no-version");

    await page.getByPlaceholder("your@email.com").fill("a@a.com");
    await page.getByPlaceholder(/•/).fill("ok");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("aside.sidebar")).toBeVisible();
    await expect(page.getByTestId("app-version")).toHaveCount(0);
    await expect(page.locator("aside.sidebar")).not.toContainText(/Version/);
    await shot(page, "web-sidebar-1280x720-no-version");
  });
});
