import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * A free session on a reserved seat (2026-11-19, owner): the owner's switch on
 * the Prices page, and the Start dialog's larger «Бесплатно» switch offered
 * on a seat with a reservation 45 min ahead only when that switch is on. Real
 * bundle and CSS, ru/en/am × desktop/phone. `FREE_OVER_BOOKING_SHOTS=<dir>`
 * writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.FREE_OVER_BOOKING_SHOTS;
const shot = async (page: Page, name: string, selector: string) => {
  if (SHOTS) await page.locator(selector).first().screenshot({ path: `${SHOTS}/${name}.png` });
};

type Lang = "en" | "ru" | "am";
const seat = (n: number) => ({
  id: n, branch_id: 1, place_id: 100 + n, label: `PC ${n}`, kind: "pc", status: "online", is_startable: true,
  hourly_rate: 1200, assigned_hourly_rate: 1200, current_session_id: null,
  place: { id: 100 + n, number: n, name: `Hall ${n}`, type: "vip", platform: "pc" },
});
const policy = {
  branch_id: 1, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 500, joystick_included: 2,
  joystick_charged_slots: "3,4", joystick_pricing_mode: "fixed", joystick_price_4: null, joystick_max_slot: 4,
  joystick_strategy_mode: "fixed_price", pause_limit_minutes: null, vip_min_charge_enabled: false,
  outside_food_fee_standard: 1000, outside_food_fee_vip: 1500,
};

let freeOver = true;
const puts: Record<string, unknown>[] = [];
const starts: Record<string, unknown>[] = [];
const signIn = async (page: Page, lang: Lang, width: number, sessions: unknown[] = []) => {
  await page.setViewportSize({ width, height: 900 });
  // The language first: the helper's own seed leaves an existing choice alone.
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2, 3].map(seat) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => {
    if (r.request().method() === "POST") {
      starts.push(r.request().postDataJSON());
      return r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ session: {
        id: 9, branch_id: 1, pc_id: 1, pc_label: "PC 1", mode: "open", status: "active", started_at: new Date().toISOString(),
        ends_at: null, hourly_rate: 1200, total_paid: 0, is_free: true, paused_at: null, items: [] } }) });
    }
    return r.fulfill(json({ data: sessions }));
  });
  await page.route((u) => isBackend(u) && u.pathname === "/time-packages", (r) => r.fulfill(json({ data: [] })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/start-options", (r) => r.fulfill(json({
    free_until: new Date(Date.now() + 45 * 60_000).toISOString(), max_minutes: 45, unlimited_allowed: false,
    next_booking: null, claimable_bookings: [], outside_food_fee: null, free_over_bookings: freeOver,
  })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1/billing-settings", (r) => {
    if (r.request().method() === "PUT") {
      const body = r.request().postDataJSON() as Record<string, unknown>;
      puts.push(body);
      return r.fulfill(json({ settings: { ...policy, free_session_over_bookings: body.free_session_over_bookings } }));
    }
    return r.fulfill(json({ settings: { ...policy, free_session_over_bookings: false } }));
  });
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => r.fulfill(json({
    branch: { id: 1, name: "Hall", company_id: 1, price_for_branch: { id: 1, branch_id: 1, "pc-standard": 1000, "pc-vip": 1200 } },
  })));
  // Not answered by the shared mocks (the shell's debt card throws on the
  // catch-all body); "not available" is an answer the panel handles.
  await page.route((u) => isBackend(u) && /^\/company\/\d+\/platform-billing$/.test(u.pathname), (r) => r.fulfill({
    status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not found" }),
  }));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  // The sign-in button's own words (`login.title`) in the seeded language.
  const signInLabel = { en: "Sign in", ru: "Вход", am: "Մուտք" }[lang];
  await page.getByRole("button", { name: signInLabel, exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
};

const switchesLayout = (page: Page) => page.evaluate(() => {
  const d = document.querySelector(".start-dialog") as HTMLElement;
  const r = d.getBoundingClientRect();
  const box = (sel: string) => (document.querySelector(sel) as HTMLElement).getBoundingClientRect();
  const unpaid = box('[data-testid="start-unpaid"]');
  const food = box('[data-testid="start-outside-food"]');
  const clipped = Array.from(d.querySelectorAll<HTMLElement>(".start-dialog__switches *"))
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === "hidden")
    .map((el) => el.className);
  return {
    sameRow: Math.abs(unpaid.top - food.top) < 2,
    foodRight: food.left > unpaid.right,
    sameLeft: Math.abs(unpaid.left - food.left) < 2,
    below: food.top >= unpaid.bottom,
    overflow: d.scrollWidth - d.clientWidth,
    inWindow: r.left >= 0 && r.right <= window.innerWidth,
    pastEdge: Array.from(d.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1);
    }).map((el) => el.className || el.tagName).slice(0, 5),
    clipped,
  };
});


test.beforeEach(() => { freeOver = true; puts.length = 0; starts.length = 0; });

for (const lang of ["ru", "en", "am"] as const) {
  for (const width of [1280, 390]) {
    test(`${lang} ${width}px: a reserved seat, the owner's switch on — free starts, open, with what to do`, async ({ page }) => {
      await signIn(page, lang, width);
      await page.goto("/#/branches/1/sessions");
      await page.locator('.place-cell [data-action="start"]').first().click();
      await expect(page.locator(".start-dialog")).toBeVisible();
      const sw = page.getByTestId("free-switch");
      await expect(sw).toHaveAttribute("role", "switch");
      await expect(sw).toHaveAttribute("aria-checked", "false");
      await shot(page, `free-off-${lang}-${width}`, ".start-dialog");
      await sw.click();
      await expect(sw).toHaveAttribute("aria-checked", "true");
      await expect(page.getByTestId("start-free")).toHaveClass(/is-on/);
      await expect(page.getByTestId("free-start-hint")).toBeVisible();
      const text = (await page.locator(".start-dialog").textContent()) ?? "";
      expect(text).not.toMatch(/session\.|freeOverBookings\./);
      const fits = await page.evaluate(() => {
        const d = document.querySelector(".start-dialog")!.getBoundingClientRect();
        const t = document.querySelector("[data-testid=start-free]")!.getBoundingClientRect();
        return t.left >= d.left - 1 && t.right <= d.right + 1 && document.documentElement.scrollWidth <= window.innerWidth;
      });
      expect(fits).toBe(true);
      await shot(page, `free-on-${lang}-${width}`, ".start-dialog");
      await page.getByRole("button", { name: { en: "Start", ru: "Старт", am: "Սկսել" }[lang], exact: true }).last().click();
      await expect.poll(() => starts.length).toBe(1);
      expect(starts[0]).toMatchObject({ mode: "open", is_free: true, pc_id: 1 });
      expect(starts[0]).not.toHaveProperty("duration_minutes");
    });
  }
}

test("the owner's switch off: no free on a reserved seat", async ({ page }) => {
  freeOver = false;
  await signIn(page, "ru", 1280);
  await page.goto("/#/branches/1/sessions");
  await page.locator('.place-cell [data-action="start"]').first().click();
  await expect(page.locator(".start-dialog")).toBeVisible();
  await expect(page.getByTestId("free-switch")).toHaveCount(0);
});

for (const lang of ["ru", "en", "am"] as const) {
  for (const width of [1280, 390]) {
    test(`${lang} ${width}px: Prices — the owner turns it on; the policy goes back unchanged`, async ({ page }) => {
      await signIn(page, lang, width);
      await page.goto("/#/branches/1/tariffs");
      const sw = page.getByTestId("free-over-bookings-switch");
      await sw.scrollIntoViewIfNeeded();
      await expect(sw).toHaveAttribute("aria-checked", "false");
      await sw.click();
      await expect.poll(() => puts.length).toBe(1);
      expect(puts[0]).toMatchObject({ free_session_over_bookings: true, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 500 });
      await expect(page.getByTestId("free-over-bookings-switch")).toHaveAttribute("aria-checked", "true");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await shot(page, `prices-switch-${lang}-${width}`, "[data-testid=free-over-bookings]");
    });
  }
}
