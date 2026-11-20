import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * Staff reservations (2026-11-20, owner): any length from 15 minutes (no
 * 5-hour ceiling; the branch's closing is the server's limit), and «Без
 * лимита (до закрытия)» — no length box, `until_close: true` sent instead of
 * minutes; an edit switches it on and off. en/ru/am at 1280, 1920 and the
 * smallest window (520×560).
 */
const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/reserve-until-close-2026-11-20");
const isBackend = (u: URL) => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
type Lang = "en" | "ru" | "am";
const LANGS: Lang[] = ["en", "ru", "am"];
const SIGN_IN: Record<Lang, string> = { en: "Sign in", ru: "Вход", am: "Մուտք" };
const SIZES = [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 520, height: 560 }];
const UNTIL: Record<Lang, string> = { en: "No limit (until closing)", ru: "Без лимита (до закрытия)", am: "Առանց սահմանի (մինչև փակվելը)" };
const MOVE: Record<Lang, string> = { en: "Move", ru: "Перенести", am: "Տեղափոխել" };
const NOTE: Record<Lang, string> = { en: "Until closing", ru: "До закрытия", am: "Մինչև փակվելը" };

const pad = (n: number) => String(n).padStart(2, "0");
const NOON = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Held 13:00 → 23:00 «до закрытия». */
const held = () => {
  const start = new Date(NOON.getTime() + 60 * 60_000);
  const end = new Date(NOON.getTime() + 11 * 60 * 60_000);
  return {
    id: 501, status: "pending", booking_date: ymd(start), start_time: "13:00", duration_minutes: 600,
    starts_at: start.toISOString(), ends_at: end.toISOString(), place_ids: [104],
    contact_name: "Aram", contact_phone: null, guest_name: null, source: "staff", session_id: null, editable: true,
    until_close: true,
  };
};

const open = async (page: Page, lang: Lang, size: { width: number; height: number }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.clock.setFixedTime(NOON);
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "manager", company_id: 1, branch_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: [{
      id: 2, branch_id: 1, place_id: 104, label: "PS5 4", kind: "ps", status: "online", is_startable: true, hourly_rate: 1000, current_session_id: null,
      place: { id: 104, number: 4, name: "VIP", type: "standard", platform: "ps5", status: "active" },
    }] }),
  }));
  await page.route((u) => isBackend(u) && u.pathname === "/places/reservations", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ reservations: [held()] }),
  }));
  const sent: { method: string; path: string; body: unknown }[] = [];
  await page.route((u) => isBackend(u) && (/^\/places\/\d+\/reserve$/.test(u.pathname) || /^\/places\/reservations\/\d+$/.test(u.pathname)), (r) => {
    sent.push({ method: r.request().method(), path: new URL(r.request().url()).pathname, body: r.request().postDataJSON() });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ booking: { id: 501, place_ids: [104] } }) });
  });
  await page.setViewportSize(size);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o.com");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: SIGN_IN[lang], exact: true }).click();
  await expect(page.locator(".app-shell, aside.sidebar").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(1);
  await page.getByTestId("board-calendar").click();
  await expect(page.getByTestId("bookings-calendar")).toBeVisible();
  await page.waitForTimeout(300);
  return sent;
};

const noSideways = async (page: Page) => {
  const over = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".reservation-form, .reservation-form *"))
    .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((el) => el.className || el.tagName));
  expect(over).toEqual([]);
};

for (const lang of LANGS) {
  for (const size of SIZES) {
    const tag = `${lang}-${size.width}`;

    test(`a new reservation: 7 h 30 is sent; «Без лимита» sends until_close (${tag})`, async ({ page }) => {
      const sent = await open(page, lang, size);
      await page.getByTestId("cal-create").click();
      const form = page.getByTestId("reserve-dialog");
      await expect(form).toBeVisible();

      // Any length: 7 h 30 (was refused over 5 h).
      await page.getByTestId("reserve-hold-hours").fill("7");
      await page.getByTestId("reserve-hold-minutes").fill("30");
      await expect(page.getByTestId("reserve-confirm")).toBeEnabled();

      // «Без лимита»: the length box gives way to «До закрытия».
      await form.getByText(UNTIL[lang]).click();
      await expect(page.getByTestId("reserve-hold-hours")).toHaveCount(0);
      await expect(page.getByTestId("reserve-until-close-note")).toHaveText(NOTE[lang]);
      await noSideways(page);
      await page.waitForTimeout(300);
      await form.screenshot({ path: `${SHOTS}/create-${tag}.png` });
      expect(await form.innerText()).not.toMatch(/\breserve\.[a-zA-Z]+/);

      await page.getByTestId("reserve-confirm").click();
      await expect.poll(() => sent.length).toBe(1);
      expect(sent[0].method).toBe("POST");
      expect(sent[0].body).toEqual(expect.objectContaining({ until_close: true }));
      expect(sent[0].body).not.toHaveProperty("minutes");
    });

    test(`editing «до закрытия»: shown as such; switched off sends a fixed length (${tag})`, async ({ page }) => {
      const sent = await open(page, lang, size);
      await page.getByTestId("cal-booking").first().dispatchEvent("click");
      await expect(page.getByTestId("reservation-details")).toContainText(NOTE[lang]);
      await page.getByTestId("reservation-edit").click();
      const form = page.getByTestId("reserve-dialog");
      await expect(page.getByTestId("reserve-until-close")).toBeChecked();
      await expect(page.getByTestId("reserve-until-close-note")).toBeVisible();
      await form.getByText(UNTIL[lang]).click();
      await expect(page.getByTestId("reserve-hold-hours")).toBeVisible();
      await page.getByTestId("reserve-confirm").click();
      // A change of length is a move: confirmed first, with the app's own button.
      await page.getByRole("button", { name: MOVE[lang], exact: true }).last().click();
      await expect.poll(() => sent.length).toBe(1);
      expect(sent[0]).toEqual({ method: "PATCH", path: "/places/reservations/501", body: { minutes: 600 } });
    });
  }
}
