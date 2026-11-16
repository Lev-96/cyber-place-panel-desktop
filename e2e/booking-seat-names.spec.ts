import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * The bookings calendar names a seat as its card on the board does (owner,
 * 2026-11-15): «№3 · name» when the place has a name, «№N» when it has none,
 * on every booking surface: the timeline's seat column, the seat filter, the
 * day's booking cards, a booking's tooltip, its details and the form's seat
 * picker. A long name is cut with an ellipsis and never pushes anything out;
 * the whole line is the title. 1280 and 1920, and the desktop's smallest
 * window (520×560, `electron/windowBounds.ts`), in every language.
 *
 * `CP_SHOTS_DIR` set: screenshots of each surface are written there.
 */

const isBackend = (u: URL) => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
const SHOTS = process.env.CP_SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

type Lang = "en" | "ru" | "am";
const LANGS: Lang[] = ["en", "ru", "am"];
const SIGN_IN: Record<Lang, string> = { en: "Sign in", ru: "Вход", am: "Մուտք" };
const SIZES = [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 520, height: 560 }];

/** Seat №3 has a long name (in every language, as the board's `tr` reads it), №4 a short one, №5 none. */
const LONG: Record<Lang, string> = {
  en: "Tournament stage, left of the bar by the big window",
  ru: "Турнирная сцена, слева от бара у большого окна",
  am: "Մրցաշարային բեմ, բարից ձախ՝ մեծ պատուհանի մոտ",
};
const SEATS = [
  { pcId: 1, placeId: 103, number: 3, name: LONG },
  { pcId: 2, placeId: 104, number: 4, name: { en: "VIP", ru: "VIP", am: "VIP" } },
  { pcId: 3, placeId: 105, number: 5, name: null },
];
const label = (lang: Lang, i: number) => {
  const s = SEATS[i];
  return s.name ? `№${s.number} · ${s.name[lang]}` : `№${s.number}`;
};

const pad = (n: number) => String(n).padStart(2, "0");
/**
 * The spec's "now": today at noon, on the page's clock AND here. Pinned
 * (2026-11-16) because "in an hour" was read off the real clock: run after
 * 23:00 it fell on tomorrow, off today's timeline, and every case failed at
 * `cal-item` with nothing wrong in the app.
 */
const NOON = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();
/** A staff booking on seat №3 starting in an hour (13:00), so it is on today's timeline and list. */
const booking = () => {
  const start = new Date(NOON.getTime() + 60 * 60_000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    id: 501, status: "pending",
    booking_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    start_time: `${pad(start.getHours())}:00`, duration_minutes: 60,
    starts_at: start.toISOString(), ends_at: end.toISOString(), place_ids: [103],
    contact_name: "Aram", contact_phone: "+37477777777", guest_name: null, source: "staff", session_id: null, editable: true,
  };
};

const open = async (page: Page, lang: Lang, size: { width: number; height: number }) => {
  // The page's Date reads noon whatever the hour the suite runs; its timers run as ever.
  await page.clock.setFixedTime(NOON);
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: SEATS.map((s) => ({
      id: s.pcId, branch_id: 1, place_id: s.placeId, label: `PS5 ${s.number}`, kind: "ps", status: "online", is_startable: true,
      hourly_rate: 1000, current_session_id: null,
      place: {
        id: s.placeId, number: s.number, type: "standard", platform: "ps5", status: "active",
        ...(s.name ? { name: s.name.en, i18n: { name: s.name } } : {}),
      },
    })) }),
  }));
  await page.route((u) => isBackend(u) && u.pathname === "/places/reservations", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ reservations: [booking()] }),
  }));
  await page.setViewportSize(size);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o.com");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: SIGN_IN[lang], exact: true }).click();
  await expect(page.locator(".app-shell, aside.sidebar").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(SEATS.length);
  await page.getByTestId("board-calendar").click();
  await expect(page.getByTestId("bookings-calendar")).toBeVisible();
  await expect(page.getByTestId("cal-item")).toHaveCount(1);
  await page.waitForTimeout(300); // the dialog's entrance
};

/** Whether an element's text box stays inside `outer` (its own box, clipped text included). */
const within = (page: Page, sel: string, outerSel: string) => page.evaluate(([s, o]) => {
  const el = document.querySelector<HTMLElement>(s)!;
  const outer = el.closest<HTMLElement>(o)!;
  const a = el.getBoundingClientRect();
  const b = outer.getBoundingClientRect();
  return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
}, [sel, outerSel] as const);

for (const lang of LANGS) {
  for (const size of SIZES) {
    test(`booking surfaces name the seat «№N · name», ${lang}, ${size.width}×${size.height}`, async ({ page }) => {
      await open(page, lang, size);
      const tag = `${lang}-${size.width}`;

      // The card on the board says the same line (the one source).
      await expect(page.locator(".live-grid--sessions .place-cell .id").first()).toHaveText(label(lang, 0));

      // Timeline seat column: every seat, the long one cut within its column, its whole line the title.
      const names = page.locator(".tl__seat-name");
      await expect(names).toHaveText([label(lang, 0), label(lang, 1), label(lang, 2)]);
      await expect(names.first()).toHaveAttribute("title", label(lang, 0));
      expect(await within(page, ".tl__seat-name", ".tl__seat")).toBe(true);
      const clamp = await names.first().evaluate((el) => ({ clipped: el.scrollHeight > el.clientHeight + 1, lines: Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)) }));
      expect(clamp.lines).toBeLessThanOrEqual(2);

      // The booking's block: tooltip and accessible name lead with the line.
      const block = page.getByTestId("cal-booking").first();
      expect((await block.getAttribute("data-tip"))!.startsWith(label(lang, 0))).toBe(true);

      // The day's booking card: one line, ellipsis, title, nothing past the card.
      const seat = page.locator(".cal-item__seat").first();
      await expect(seat).toHaveText(label(lang, 0));
      await expect(seat).toHaveAttribute("title", label(lang, 0));
      expect(await within(page, ".cal-item__seat", ".cal-item")).toBe(true);

      // The seat filter offers every line; the chosen one is its title.
      const filter = page.getByTestId("cal-seat-filter");
      await expect(filter.locator("option")).toContainText([label(lang, 0), label(lang, 1), label(lang, 2)]);
      await filter.selectOption("103");
      await expect(filter).toHaveAttribute("title", label(lang, 0));
      expect(await within(page, "[data-testid=cal-seat-filter]", ".cal")).toBe(true);
      await shot(page, `calendar-${tag}`);
      await filter.selectOption("");

      // The details. On the 520×560 window the sticky seat column and hour
      // scale cover most of the timeline, so Playwright's own scroll lands the
      // block under them; the click is what a person's would be once scrolled.
      await block.dispatchEvent("click");
      const details = page.getByTestId("reservation-details");
      await expect(details).toContainText(label(lang, 0));
      if (SHOTS) await page.waitForTimeout(400); // the dialog's entrance, for the picture
      await shot(page, `details-${tag}`);

      // The form's seat picker (Edit from the details).
      await page.getByTestId("reservation-edit").click();
      const picker = page.getByTestId("reserve-dialog").locator("select").first();
      await expect(picker.locator("option:checked")).toHaveText(label(lang, 0));
      await expect(picker).toHaveAttribute("title", label(lang, 0));
      expect(await within(page, "[data-testid=reserve-dialog] select", "[data-testid=reserve-dialog]")).toBe(true);
      if (SHOTS) await page.waitForTimeout(400);
      await shot(page, `form-${tag}`);

      // Nothing a seat's name is drawn in scrolls sideways for a long name.
      // (`.cal` itself is not asked: at 520 its two-week date strip is wider
      // than the window, with or without names; measured on the build before
      // this change, 668px of chips in a 454px calendar.)
      const sideways = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("html, .cal__head, .tl__seat, .cal-list, .reservation-form"))
        .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className || el.tagName));
      expect(sideways).toEqual([]);
    });
  }
}
