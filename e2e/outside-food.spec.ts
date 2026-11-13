import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * «Свои продукты» (2026-11-13, owner) on the real bundle and CSS: the Start
 * dialog's two switches share one row on a desktop and wrap cleanly on a
 * phone, in every language, nothing past the dialog's edge; the card's note;
 * the Prices page form. `OUTSIDE_FOOD_SHOTS=<dir>` also writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.OUTSIDE_FOOD_SHOTS;
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

const signIn = async (page: Page, lang: Lang, width: number, sessions: unknown[] = []) => {
  await page.setViewportSize({ width, height: 900 });
  // The language first: the helper's own seed leaves an existing choice alone.
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2, 3].map(seat) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: sessions })));
  await page.route((u) => isBackend(u) && u.pathname === "/time-packages", (r) => r.fulfill(json({ data: [] })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/start-options", (r) => r.fulfill(json({
    free_until: null, max_minutes: null, unlimited_allowed: true, next_booking: null, claimable_bookings: [], outside_food_fee: 1500,
  })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1/billing-settings", (r) => r.fulfill(json({ settings: policy })));
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

for (const lang of ["ru", "en", "am"] as const) {
  for (const width of [1280, 390]) {
    test(`${lang} ${width}px: the two switches as a pair, the fee said, nothing past the edge`, async ({ page }) => {
      await signIn(page, lang, width);
      await page.goto("/#/branches/1/sessions");
      await page.locator('.place-cell [data-action="start"]').first().click();
      await expect(page.locator(".start-dialog")).toBeVisible();
      await page.getByTestId("outside-food-switch").click();
      await expect(page.getByTestId("outside-food-switch")).toHaveAttribute("aria-checked", "true");
      await page.getByTestId("unpaid-switch").click();
      await expect(page.getByTestId("outside-food-hint")).toContainText(/1[\s,.  ]?500/);
      await expect(page.getByTestId("start-summary")).toContainText(/1[\s,.  ]?500/);

      const l = await switchesLayout(page);
      if (width >= 1280) {
        expect(l.sameRow, JSON.stringify(l)).toBe(true);
        expect(l.foodRight, JSON.stringify(l)).toBe(true);
      } else {
        expect(l.below, JSON.stringify(l)).toBe(true);
        expect(l.sameLeft, JSON.stringify(l)).toBe(true);
      }
      expect(l.overflow).toBeLessThanOrEqual(0);
      expect(l.inWindow, JSON.stringify(l)).toBe(true);
      expect(l.pastEdge, JSON.stringify(l)).toEqual([]);
      expect(l.clipped, JSON.stringify(l)).toEqual([]);
      await shot(page, `start-dialog-${lang}-${width}`, ".start-dialog");
    });
  }
}

for (const lang of ["ru", "en", "am"] as const) {
  test(`${lang}: the card names the fee in the panel's language`, async ({ page }) => {
    const started = new Date(Date.now() - 20 * 60_000).toISOString();
    await signIn(page, lang, 1280, [{
      id: 42, branch_id: 1, pc_id: 1, pc_label: "PC 1", mode: "open", status: "active", started_at: started, ends_at: null,
      hourly_rate: 1200, total_paid: 0, is_free: false, paused_at: null,
      items: [
        { id: 7, name: "Свои продукты", price: "1500.00", qty: 1, product_id: null, kind: "outside_food" },
        { id: 8, name: "Cola", price: "500.00", qty: 1, product_id: 3, kind: null },
      ],
    }]);
    await page.goto("/#/branches/1/sessions");
    const note = page.getByTestId("outside-food-note-1");
    await expect(note).toBeVisible();
    await expect(note).toContainText(/1[\s,.  ]?500/);
    if (lang !== "ru") await expect(note).not.toContainText("Свои продукты");
    await shot(page, `card-${lang}`, ".session-card--running");
  });
}

// The Prices page at the desktop and at the window's minimum (520px,
// `electron/windowBounds.ts`): below that the shell's own side menu leaves the
// page ~120px, which is the shell's layout, not this form's.
for (const lang of ["ru", "en", "am"] as const) {
  for (const width of [1280, 520]) {
    test(`${lang} ${width}px: Prices → «Свои продукты», both tiers, nothing past the section`, async ({ page }) => {
      await signIn(page, lang, width);
      await page.goto("/#/branches/1/tariffs");
      const form = page.locator(".outside-food-form");
      await expect(form).toBeVisible();
      await form.scrollIntoViewIfNeeded();
      const l = await form.evaluate((f) => {
        const r = f.getBoundingClientRect();
        return {
          inWindow: r.left >= 0 && r.right <= window.innerWidth,
          pastEdge: Array.from(f.querySelectorAll<HTMLElement>("*")).filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1);
          }).map((el) => el.className || el.tagName).slice(0, 5),
        };
      });
      expect(l.inWindow, JSON.stringify(l)).toBe(true);
      expect(l.pastEdge, JSON.stringify(l)).toEqual([]);
      const section = form.locator("xpath=ancestor::section[1]");
      await shot(page, `prices-${lang}-${width}`, (await section.count()) ? ".outside-food-form >> xpath=ancestor::section[1]" : ".outside-food-form");
    });
  }
}
