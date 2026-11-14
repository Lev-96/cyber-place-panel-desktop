import { expect, test } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * A live session's terms, in a real browser.
 *
 * The unit tests prove the components in isolation and the backend tests prove
 * the rules. Neither answers the question a cashier actually has: after signing
 * in, on the real bundle, with the real router and the real CSS — is the
 * control there, and is it there for the right person?
 *
 * Two claims, and both are about money:
 *
 *   - the pad line on a tile NAMES the controller in play, so "which extra is
 *     out, and at what price" is answerable without opening anything;
 *   - waiving a bill is drawn for the roles that hold `session.free`. The
 *     server asserts the same capability, so this is not the enforcement — it
 *     is the half a person sees, and a control drawn for somebody the server
 *     refuses is a 403 they cannot act on.
 */

const isBackend = (url: URL): boolean =>
  url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

const PLACE = { id: 10, number: 1, name: "PS5 VIP", type: "standard", platform: "ps5" };

const FREE_PLACE = { id: 11, number: 2, name: "PC-1", type: "standard", platform: "pc" };

/**
 * One console, one session on it, three controllers in play — the server's
 * numbers, and the counts the current model produces.
 *
 * A PlayStation comes with a kit of TWO that nobody hands over, so a seat
 * holding one extra reads three in play, and the extra is NAMED rather than
 * counted: `3/4`, because this venue prices the third and the fourth as one
 * figure.
 */
const seedFloor = async (page: import("@playwright/test").Page) => {
  await page.route(
    (url) => isBackend(url) && url.pathname === "/pcs",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: 1, branch_id: 1, place_id: 10, label: "PS5 VIP", kind: "ps",
              status: "online", is_startable: true, current_session_id: 5, place: PLACE,
            },
            // A seat nobody is on, so Start is reachable.
            {
              id: 2, branch_id: 1, place_id: 11, label: "PC-1", kind: "pc",
              status: "online", is_startable: true, hourly_rate: 1000, place: FREE_PLACE,
            },
          ],
        }),
      });
    },
  );

  await page.route(
    (url) => isBackend(url) && url.pathname === "/sessions",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{
            id: 5, branch_id: 1, pc_id: 1, pc_label: "PS5 VIP", mode: "fixed",
            started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
            ends_at: new Date(Date.now() + 40 * 60_000).toISOString(),
            status: "active", total_paid: 1500,
            // The count is the SERVER's. Nothing on the tile derives it.
            joystick_count: 3,
            joysticks: [{
              id: 9, slot: 3, price: 500, is_charged: true, is_hourly: false,
              started_at: new Date(Date.now() - 10 * 60_000).toISOString(), stopped_at: null,
            }],
            joystick_rule: {
              included: 2, price: 500, price_4: null, max: 4, max_slot: 4,
              charged_slots: [3, 4], hourly: false, shared: true,
              options: [
                { slot: 3, price: 500, shared: true },
                { slot: 4, price: 500, shared: true },
              ],
            },
            joystick_strategy: "fixed",
            is_free: false, is_unlimited: false,
            supports_joysticks: true, place_platform: "ps5",
          }],
        }),
      });
    },
  );
};

const signIn = async (page: import("@playwright/test").Page, email: string) => {
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
};

test("the extra controller in play is named in the note a press brings, never on the tile", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");
  await expect(page.getByTestId("pad-toggle")).toBeVisible();

  // Not on the tile (owner, 2026-11-04: the line made the card taller).
  const tile = page.locator(".place-cell.session-card--running").first();
  await expect(tile).not.toContainText("3/4");

  // Taking the pad back is the press this seat offers; the server answers
  // with the same seat, and the note says what it holds: the identity plus
  // its money, on one line, never "Joystick #3" again.
  await page.route((url) => isBackend(url) && /\/sessions\/5\/joysticks/.test(url.pathname), (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: { id: 5 } }) }));
  await page.getByTestId("pad-remove").click();
  const note = page.getByTestId("pad-note-5");
  await expect(note).toBeVisible();
  await expect(note).toContainText(/3\/4 · /);
  await expect(note).not.toContainText(/Joystick #3/);
});

/**
 * The waiver is NOT on the running-session dialog, and that is the claim.
 *
 * This pair of tests used to assert it was there, drawn for an owner and not
 * for a manager. Both halves have since moved: the control left this dialog
 * entirely — Start Session owns the decision, because waiving a bill that has
 * already been quoted is a different act from starting a free one — and
 * `session.free` became a manager's capability on 2026-09-06, for the reason
 * written down in `src/auth/permissions.ts`.
 *
 * Neither Playwright suite is part of `npm test`, so nothing said so for a
 * week. What is pinned here now is the placement, per role, at the level a
 * cashier meets it.
 */
/**
 * The menu that hands a pad over keeps its room once a pad is out.
 *
 * Measured, because this broke by arithmetic rather than by anything visible
 * in the markup. The pad line carries the identity AND what it earned, and
 * that plus the menu plus the take-back button wants 252px on a 160px tile.
 * The row was `nowrap` and the menu was the only item that could shrink, so it
 * was squeezed to 21px — a control with no room for a word, showing nothing
 * but its own chevron hard against the border, which is what an operator
 * reported as "the arrow is outside the box".
 *
 * The row wraps now. The assertion is on the WIDTH rather than on a screenshot
 * because that is the thing that went wrong, and it fails the moment anybody
 * makes the line beside it longer again.
 *
 * Since 22eaea8 (2026-10-25) the select is the «+🎮» switch (`PadToggle`): ONE
 * cell of the action grid. With a pad out and a fourth one on offer the cell
 * splits into two equal halves, lit «take back» and unlit «hand out». The claim
 * is the same: with a controller out, both presses are on the tile, neither is
 * squeezed, and the cell is as wide as the action beside it.
 */
test("the pad switch keeps its width when a controller is out", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });

  const pads = page.getByTestId("pad-toggle").first();
  // Pad 3 is out (seedFloor): the lit «take back», and pad 4 still offered.
  await expect(pads.getByTestId("pad-remove")).toHaveAttribute("aria-pressed", "true");
  await expect(pads.getByTestId("pad-add")).toBeEnabled();

  const sizes = await pads.evaluate((cell) => {
    const w = (el: Element | null) => Math.round(el!.getBoundingClientRect().width);
    return {
      cell: w(cell),
      remove: w(cell.querySelector('[data-testid="pad-remove"]')),
      add: w(cell.querySelector('[data-testid="pad-add"]')),
      // The action that shares its row: «+ Product».
      neighbour: w(cell.nextElementSibling),
    };
  });
  // Two equal halves; a half wide enough to be pressed (the icon is 18px).
  expect(Math.abs(sizes.remove - sizes.add)).toBeLessThanOrEqual(1);
  expect(sizes.remove).toBeGreaterThanOrEqual(40);
  // The switch never takes less room than the action beside it.
  expect(Math.abs(sizes.cell - sizes.neighbour)).toBeLessThanOrEqual(1);

  // …and the tile it sits on does not scroll sideways to hold it.
  const overflows = await page.locator(".place-cell").first()
    .evaluate((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth);
  expect(overflows).toBe(false);
});

test("the running-session dialog does not carry the waiver", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");
  await page.getByRole("button", { name: "Add time" }).first().click();

  // The dialog IS open — this is one of the things it does own. Since
  // 362862a (2026-11-07) it is the one «Add time» dialog for every mode.
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Add time");
  await expect(page.getByText("Free session", { exact: true })).toHaveCount(0);
});

test("an owner can start a session free", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");
  await page.getByRole("button", { name: "Start", exact: true }).first().click();

  await expect(page.getByText("Free session", { exact: true })).toBeVisible();
});

/**
 * And so can a manager — the same rule as the running-session waiver, because
 * it is the same decision. The server asserts `sessions.free` on POST /sessions
 * too, so this is the half a person sees rather than the enforcement.
 */
test("and so can a manager", async ({ page }) => {
  await installBackendMocks(page, {
    role: "manager", company_id: 1, branch_id: 1, name: "Manager One",
  });
  await seedFloor(page);
  await signIn(page, "m@m");
  await expect(page.getByText("Manager One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");
  await page.getByRole("button", { name: "Start", exact: true }).first().click();

  // The dialog IS open — a manager starts sessions all day.
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(2);
  await expect(page.getByText("Free session", { exact: true })).toBeVisible();
});

/**
 * The action grid is EVEN, in a real browser with the real CSS: every row is
 * two equal buttons or one full-width button, all one height, no label clipped,
 * and «Пересадить» (Move) spans the row like Stop. An odd count of half-width
 * actions must not leave a hole — the last one takes the row (a `:has()` rule
 * jsdom cannot evaluate, which is why this lives here).
 *
 * A grid CELL is a direct child of the grid: since 22eaea8 the «+🎮» switch is
 * one cell that may hold two half-buttons, so rows are measured by cell, and
 * the switch's halves are checked to be equal on their own.
 */
test("the session card's actions are even rows with nothing clipped", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });
  await expect(page.locator(".session-card--running").first()).toBeVisible();

  const layout = await page.locator(".session-card--running").first().evaluate((card) => {
    const grid = card.querySelector(".session-card__actions") as HTMLElement;
    const gridWidth = grid.getBoundingClientRect().width;
    const buttons = [...grid.querySelectorAll(".btn")] as HTMLElement[];
    const cells = [...grid.children] as HTMLElement[];
    const rows: Record<number, number[]> = {};
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      (rows[Math.round(r.top)] ??= []).push(Math.round(r.width));
    }
    const named = (n: string) => buttons.find((b) => b.getAttribute("aria-label") === n)!;
    const halves = [...grid.querySelectorAll(".pad-toggle > .btn")]
      .map((b) => Math.round(b.getBoundingClientRect().width));
    return {
      gridWidth: Math.round(gridWidth),
      rows: Object.values(rows),
      halves,
      heights: [...new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().height)))],
      clipped: buttons.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent),
      move: Math.round(named("Move player").getBoundingClientRect().width),
      stop: Math.round(named("Stop").getBoundingClientRect().width),
    };
  });

  expect(layout.heights).toHaveLength(1);
  expect(layout.clipped).toEqual([]);
  for (const row of layout.rows) {
    if (row.length === 2) expect(Math.abs(row[0] - row[1])).toBeLessThanOrEqual(1);
    else expect(row).toEqual([layout.gridWidth]);
  }
  // seedFloor has pad 3 out and pad 4 on offer: the switch is two equal halves.
  expect(layout.halves).toHaveLength(2);
  expect(Math.abs(layout.halves[0] - layout.halves[1])).toBeLessThanOrEqual(1);
  expect(layout.move).toBe(layout.gridWidth);
  expect(layout.stop).toBe(layout.gridWidth);
});

/**
 * Start lines up across a row and keeps its distance from the frame.
 *
 * Cards in a row share one height and every card's bottom control is pinned to
 * its foot, so a free seat's Start sits on the same line as a running
 * neighbour's Stop and as a free seat whose content is taller (an offline hint,
 * a console chip) — with 14px of the card under it, never on the border.
 */
test("Start lines up across a row, with air under it", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  // One row of three PlayStations: running, free, and free-but-offline.
  await page.route(
    (url) => isBackend(url) && url.pathname === "/pcs",
    async (route) => {
      const ps = (id: number, number: number, label: string, extra: Record<string, unknown> = {}) => ({
        id, branch_id: 1, place_id: 10 + id, label, kind: "ps", status: "online", is_startable: true,
        place: { id: 10 + id, number, name: label, type: "standard", platform: "ps5" }, ...extra,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [
          { id: 1, branch_id: 1, place_id: 10, label: "PS5 VIP", kind: "ps", status: "online", is_startable: true, current_session_id: 5, place: PLACE },
          ps(3, 3, "PS5 free"),
          // A kiosk PC bound to a PS5 place whose agent is silent: offline, with
          // the two-line hint above its Start.
          ps(4, 4, "PS5 offline", { kind: "pc", status: "offline", is_startable: false, last_seen_at: null }),
          // …and a free seat alone in its own row, where nothing stretches it.
          { id: 2, branch_id: 1, place_id: 11, label: "PC-1", kind: "pc", status: "online", is_startable: true,
            last_seen_at: new Date().toISOString(), place: FREE_PLACE },
          // An offline seat alone in ITS row: taller than the card's minimum,
          // so only the foot's own padding keeps Start off the hint.
          { id: 5, branch_id: 1, place_id: 15, label: "Pool", kind: "pc", status: "offline", is_startable: false, last_seen_at: null,
            place: { id: 15, number: 9, name: "Pool", type: "standard", platform: "billiard" } },
        ] }),
      });
    },
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });
  await expect(page.locator(".session-card--running").first()).toBeVisible();

  // Cards fade in; measure the settled layout, not a frame of the animation.
  // (The page's decorative background loops forever, so only finite ones count.)
  await page.waitForFunction(() => document.getAnimations()
    .filter((a) => a.effect?.getTiming().iterations !== Infinity)
    .every((a) => a.playState !== "running"));
  const box = async (sel: string) => page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  const stop = await box(".session-card--running .session-card__btn.is-danger");
  const free = page.locator(".session-card--idle", { hasText: "PS5 free" });
  const offline = page.locator(".session-card--idle", { hasText: "PS5 offline" });

  const measure = (card: import("@playwright/test").Locator) => card.evaluate((c) => {
    const start = c.querySelector(".session-card__start") as HTMLElement;
    // Whatever sits right above the foot: the status, or an offline hint.
    const prev = (c.querySelector(".session-card__foot") as HTMLElement).previousElementSibling as HTMLElement;
    const r = c.getBoundingClientRect();
    const s = start.getBoundingClientRect();
    return {
      startBottom: s.bottom,
      below: Math.round(r.bottom - s.bottom),
      above: Math.round(s.top - prev.getBoundingClientRect().bottom),
    };
  });
  const a = await measure(free);
  const b = await measure(offline);

  // One line across the row.
  expect(Math.abs(a.startBottom - stop.bottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.startBottom - stop.bottom)).toBeLessThanOrEqual(1);
  // Distance from the frame (14px padding + the border), and air above Start.
  expect(a.below).toBeGreaterThanOrEqual(14);
  expect(a.below).toBeLessThanOrEqual(17);
  expect(a.above).toBeGreaterThanOrEqual(10);
  expect(b.above).toBeGreaterThanOrEqual(10);

  const alone = await measure(page.locator(".session-card--idle", { hasText: "PC-1" }));
  expect(alone.above).toBeGreaterThanOrEqual(10);
  expect(alone.below).toBeGreaterThanOrEqual(14);
  const tall = await measure(page.locator(".session-card--idle", { hasText: "Pool" }));
  expect(tall.above).toBeGreaterThanOrEqual(10);
  expect(tall.below).toBeGreaterThanOrEqual(14);
});
