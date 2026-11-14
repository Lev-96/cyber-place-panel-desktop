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

/* ── Own amounts for single places (2026-11-14, owner) ─────────────────────
   ~30 places (pc standard / pc VIP / PS5, one inactive) on the Prices page:
   the tabs and the search, one own figure and one «not charged here», the PUT
   body captured, a mocked reload, and the layout in every language at the
   desktop, the window's minimum and a phone. */
type MockPlace = {
  id: number; branch_id: number; number: number; name: string | null; type: "standard" | "vip";
  status: "active" | "inactive"; platform: string; outside_food_fee: number | null; games: never[];
};
const mockPlaces = (): MockPlace[] => Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  const platform = n <= 20 ? "pc" : "ps5";
  const type = (n >= 13 && n <= 18) || n >= 28 ? "vip" : "standard";
  return {
    id: 500 + n, branch_id: 1, number: n,
    name: n === 9 ? "Угловое место у окна" : n === 25 ? "Lounge sofa" : null,
    type, status: n === 11 ? "inactive" : "active", platform,
    outside_food_fee: n === 13 ? 2000 : n === 22 ? 0 : null, games: [],
  };
});

const placesRoutes = async (page: Page) => {
  const state = { places: mockPlaces(), puts: [] as Record<string, unknown>[] };
  await page.route((u) => isBackend(u) && u.pathname === "/places", (r) => r.fulfill(json({
    data: state.places, meta: { total: state.places.length, current_page: 1, last_page: 1, per_page: 1000 },
  })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1/billing-settings", async (r) => {
    if (r.request().method() === "PUT") {
      const body = r.request().postDataJSON() as Record<string, unknown>;
      state.puts.push(body);
      // The backend writes the rows; the next read reflects them.
      for (const row of (body.outside_food_place_fees ?? []) as { place_id: number; fee: number | null }[]) {
        const p = state.places.find((x) => x.id === row.place_id);
        if (p) p.outside_food_fee = row.fee;
      }
    }
    await r.fulfill(json({ settings: policy }));
  });
  return state;
};

const placesWords = {
  ru: { all: "Все", own: "Со своей суммой", notHere: "Здесь не взимается", search: "Номер или название места",
    save: "Сохранить", summaryAfter: "Своя сумма: 2 · не взимается: 2 · как в филиале: 26" },
  en: { all: "All", own: "With own amount", notHere: "Not charged here", search: "Place number or name",
    save: "Save", summaryAfter: "Own amount: 2 · not charged: 2 · like the branch: 26" },
  am: { all: "Բոլորը", own: "Սեփական գումարով", notHere: "Այստեղ չի գանձվում", search: "Տեղի համարը կամ անունը",
    save: "Պահպանել", summaryAfter: "Սեփական գումար՝ 2 · չի գանձվում՝ 2 · ինչպես մասնաճյուղում՝ 26" },
} as const;

test("ru: tabs, search, one own figure and one «not charged», the PUT body, the summary after the reload", async ({ page }) => {
  await signIn(page, "ru", 1280);
  const state = await placesRoutes(page);
  await page.goto("/#/branches/1/tariffs");
  const field = page.getByTestId("outside-food-places");
  await expect(field).toBeVisible();
  await field.scrollIntoViewIfNeeded();
  const w = placesWords.ru;

  // «With own amount» is the default: two places have one.
  const ownTab = field.getByRole("tab", { name: new RegExp(`^${w.own}`) });
  await expect(ownTab).toHaveAttribute("aria-selected", "true");
  await expect(ownTab).toContainText("2");
  await expect(field.getByTestId(/^outside-food-place-/)).toHaveCount(2);
  await expect(field.getByRole("tab", { name: new RegExp(`^${w.all}`) })).toContainText("30");
  await expect(field.getByRole("tab", { name: /^VIP/ })).toContainText("9");
  await expect(field.getByRole("tab", { name: /^Обычные/ })).toContainText("21");

  // All, grouped by platform, sorted by number; the inactive one says so.
  await field.getByRole("tab", { name: new RegExp(`^${w.all}`) }).click();
  await expect(field.getByTestId(/^outside-food-place-/)).toHaveCount(30);
  await expect(field.getByTestId("outside-food-group")).toHaveCount(2);
  await expect(field.getByTestId("outside-food-place-511")).toContainText("неактивно");
  // The placeholder follows the tier figure.
  await expect(field.getByTestId("outside-food-place-503").locator("input.input")).toHaveAttribute("placeholder", /Как в филиале \(1[\s  ,.]?000/);
  await expect(field.getByTestId("outside-food-place-514").locator("input.input")).toHaveAttribute("placeholder", /Как в филиале \(1[\s  ,.]?500/);

  // Search: by name, then by number.
  const search = field.getByRole("searchbox", { name: w.search });
  await search.fill("углов");
  await expect(field.getByTestId(/^outside-food-place-/)).toHaveCount(1);
  await expect(field.getByTestId("outside-food-place-509")).toContainText("№9 · Угловое место у окна");
  await search.fill("3");
  await expect(field.getByTestId(/^outside-food-place-/)).toHaveCount(2); // №3, №30
  await field.getByTestId("outside-food-place-503").locator("input.input").fill("1800");
  await search.fill("");

  // «Not charged here» on №7.
  await field.getByTestId("outside-food-place-507").getByText(w.notHere).click();
  await expect(field.getByTestId("outside-food-place-507").locator("input.input")).toBeDisabled();
  await expect(field).toContainText("Несохранённых изменений: 2");
  await expect(page.locator(".outside-food-form")).toContainText("Действует для новых стартов");
  await shot(page, "places-editing-ru-1280", ".outside-food-form");

  await page.locator(".outside-food-form").getByRole("button", { name: w.save, exact: true }).click();
  await expect.poll(() => state.puts.length).toBe(1);
  expect(state.puts[0]).toMatchObject({ outside_food_fee_standard: 1000, outside_food_fee_vip: 1500 });
  expect(state.puts[0].outside_food_place_fees).toEqual([
    { place_id: 503, fee: 1800 },
    { place_id: 507, fee: 0 },
  ]);

  // The reload re-opens the form on the server's figures.
  await expect(page.getByTestId("outside-food-summary")).toHaveText(w.summaryAfter);
  await expect(field).not.toContainText("Несохранённых изменений");
  await expect(page.getByTestId("outside-food-places").getByRole("tab", { name: new RegExp(`^${w.own}`) })).toContainText("4");
});

const placesLayout = (page: Page) => page.evaluate(() => {
  const form = document.querySelector(".outside-food-form") as HTMLElement;
  const r = form.getBoundingClientRect();
  const list = document.querySelector('[data-testid="outside-food-places-list"]') as HTMLElement;
  const clipped = Array.from(form.querySelectorAll<HTMLElement>(
    ".outside-food-place__label, .outside-food-place__chip, .outside-food-place__state, .cp-checkbox-label, .cp-subtab, .outside-food-places__summary span, .outside-food-places__platform",
  )).filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.className}:${el.textContent}`);
  // A placeholder wider than its box is cut by the browser: measure it.
  const ctx = document.createElement("canvas").getContext("2d")!;
  const cutPlaceholders = Array.from(form.querySelectorAll<HTMLInputElement>(".outside-food-place input.input")).filter((i) => {
    if (!i.placeholder || i.value) return false;
    const cs = getComputedStyle(i);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const room = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return ctx.measureText(i.placeholder).width > room + 1;
  }).map((i) => {
    const cs = getComputedStyle(i);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return `${i.placeholder} (${Math.ceil(ctx.measureText(i.placeholder).width)}px in ${Math.floor(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))}px)`;
  }).slice(0, 3);
  return {
    formWidth: Math.round(r.width),
    listHeight: list.getBoundingClientRect().height,
    listScrolls: list.scrollHeight > list.clientHeight,
    inWindow: r.left >= 0 && r.right <= window.innerWidth + 0.5,
    overflow: form.scrollWidth - form.clientWidth,
    pastEdge: Array.from(form.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1);
    }).map((el) => el.className || el.tagName).slice(0, 5),
    clipped: clipped.slice(0, 5),
    cutPlaceholders,
  };
});

for (const lang of ["ru", "en", "am"] as const) {
  for (const width of [1280, 520, 390]) {
    test(`${lang} ${width}px: the places list fits — ≤320px with its own scroll, nothing past the form, no clipped label`, async ({ page }) => {
      await signIn(page, lang, width);
      await placesRoutes(page);
      await page.goto("/#/branches/1/tariffs");
      // A phone is the owner web, whose side menu lives in a closed drawer; in
      // this harness the panel's own side menu stays and leaves the page ~90px,
      // which is the shell's layout and not this form's. Hidden here so 390px
      // measures what a phone shows.
      if (width < 520) await page.addStyleTag({ content: "aside.sidebar { display: none !important; } .app-shell { grid-template-columns: 1fr !important; }" });
      const field = page.getByTestId("outside-food-places");
      await expect(field).toBeVisible();
      await field.getByRole("tab", { name: new RegExp(`^${placesWords[lang].all}`) }).click();
      await expect(field.getByTestId(/^outside-food-place-/)).toHaveCount(30);
      // A typed figure and a «not charged» row, so every chip state is drawn.
      await field.getByTestId("outside-food-place-501").locator("input.input").fill("1800");
      await field.getByTestId("outside-food-place-502").getByText(placesWords[lang].notHere).click();
      await page.locator(".outside-food-form").scrollIntoViewIfNeeded();

      const l = await placesLayout(page);
      expect(l.listHeight, JSON.stringify(l)).toBeLessThanOrEqual(320.5);
      expect(l.listScrolls, JSON.stringify(l)).toBe(true);
      expect(l.inWindow, JSON.stringify(l)).toBe(true);
      expect(l.overflow, JSON.stringify(l)).toBeLessThanOrEqual(0);
      expect(l.pastEdge, JSON.stringify(l)).toEqual([]);
      expect(l.clipped, JSON.stringify(l)).toEqual([]);
      // The placeholder «Like the branch (1,000 AMD)» fits whole on a desktop
      // row; on a narrow one the box is the row's width and the browser may
      // cut its end; the row's state chip says «Like the branch» in full there.
      if (width >= 1280) expect(l.cutPlaceholders, JSON.stringify(l)).toEqual([]);
      else console.log(`${lang} ${width}: form ${l.formWidth}px, cut placeholders: ${l.cutPlaceholders.length ? l.cutPlaceholders[0] : "none"}`);
      await shot(page, `places-${lang}-${width}`, ".outside-food-form");
    });
  }
}
