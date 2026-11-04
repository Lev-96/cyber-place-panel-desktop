import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * A pad press on a running PlayStation seat (owner, 2026-11-04), on the real
 * bundle and CSS, grid and list: nothing is written on the card — its size is
 * the same before, during and after — and an orange note beside it says what
 * the press did ("3/4 · 500 AMD", "Rate now: … /h") for 5 seconds, then goes.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

const RULE = {
  included: 2, price: 500, price_4: null, max: 4, max_slot: 4, charged_slots: [3, 4],
  hourly: false, shared: true, options: [{ slot: 3, price: 500, shared: true }, { slot: 4, price: 500, shared: true }],
};
const base = {
  id: 5, branch_id: 1, pc_id: 1, pc_label: "PS5 1", mode: "open", status: "active",
  started_at: new Date(Date.now() - 20 * 60_000).toISOString(), ends_at: null, hourly_rate: 1800,
  total_paid: 0, is_free: false, is_unlimited: true, supports_joysticks: true, place_platform: "ps5",
  joystick_rule: RULE, joystick_count: 2, joysticks: [],
};
// After the press: the pad is out, charged by the hour, and the seat's rate moved.
const after = {
  ...base, joystick_count: 3, joystick_rule: { ...RULE, hourly: true },
  joysticks: [{ id: 9, slot: 3, price: 500, is_charged: true, is_hourly: true, started_at: new Date().toISOString(), stopped_at: null }],
};

const seed = async (page: Page, view: "grid" | "list") => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  let current: unknown = base;
  await page.route((u) => isBackend(u) && u.pathname === "/user/preferences", (r) => r.fulfill(json({ preferences: {
    data: { interface: "custom", theme: "dark", layout: { board_view: view, density: "standard", card_size: "m" } },
    schema_version: 1, onboarding_version: 1, onboarded_at: null,
  } })));
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2, 3].map((n) => ({
    id: n, branch_id: 1, place_id: 10 + n, label: `PS5 ${n}`, kind: "ps", status: "online", is_startable: true,
    current_session_id: n === 1 ? 5 : null, place: { id: 10 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "ps5" },
  })) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: [current] })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/5/joysticks", (r) => {
    current = after;
    return r.fulfill(json({ joystick: { id: 9, slot: 3, hourly_rate: 500, started_at: new Date().toISOString() }, session: after }));
  });
};

const open = async (page: Page, view: "grid" | "list") => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, view);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.getByTestId("pad-add")).toBeVisible();
  await page.waitForTimeout(300);
};

const cardBox = (page: Page) => page.locator(".place-cell.session-card--running").first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
});

for (const view of ["grid", "list"] as const) {
  test(`${view}: a pad press writes nothing on the card and says it in an orange note for 5s`, async ({ page }) => {
    test.setTimeout(60_000);
    await open(page, view);
    const before = await cardBox(page);
    const rowsBefore = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".live-grid--sessions > .place-cell")).map((c) => Math.round(c.getBoundingClientRect().height)));

    await page.getByTestId("pad-add").click();
    const note = page.getByTestId("pad-note-5");
    await expect(note).toBeVisible();
    await expect(note).toContainText("3/4");
    await expect(note).toContainText(/\/h|\/ч/);

    // The card: same size, nothing written in it; its neighbours too.
    expect(await cardBox(page)).toEqual(before);
    const rowsAfter = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".live-grid--sessions > .place-cell")).map((c) => Math.round(c.getBoundingClientRect().height)));
    expect(rowsAfter).toEqual(rowsBefore);
    const facts = await page.evaluate(() => {
      const n = document.querySelector('[data-testid="pad-note-5"]') as HTMLElement;
      const card = document.querySelector(".place-cell.session-card--running") as HTMLElement;
      const cs = getComputedStyle(n);
      return {
        inCard: card.contains(n),
        cardText: card.textContent ?? "",
        border: cs.borderTopColor,
        clickable: cs.pointerEvents !== "none",
        inWindow: (() => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight; })(),
      };
    });
    expect(facts.inCard).toBe(false);
    expect(facts.cardText).not.toContain("3/4");
    expect(facts.border).toBe("rgb(245, 158, 11)");
    expect(facts.clickable).toBe(false);
    expect(facts.inWindow).toBe(true);

    // Gone after its 5 seconds.
    await expect(note).toBeHidden({ timeout: 6500 });
  });
}
