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

test("the tile names the extra controller in play", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");

  // The identity, not a quantity: the pair this venue prices as one figure.
  await expect(page.getByText("3/4").first()).toBeVisible();
  // …and what they have earned, on the SAME line. The card used to carry a
  // second one naming the controllers again ("Joystick #3 · 500 AMD = 500
  // AMD"); on a 160px tile that was most of the card, and every number on it
  // is either printed beside it or on the receipt.
  await expect(page.getByText(/^3\/4 · /)).toBeVisible();
  await expect(page.getByText(/Joystick #3/)).toHaveCount(0);
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
 */
test("the pad menu keeps its width when a controller is out", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });

  const menu = page.locator("select.pad-select").first();
  await expect(menu).toBeVisible();

  const box = await menu.boundingBox();
  expect(box, "the pad menu is on the tile").not.toBeNull();
  // Its own chevron is 8px and sits 3px from the right edge. Anything near
  // that number is the arrow alone; 90 is a word plus the arrow.
  expect(box!.width).toBeGreaterThanOrEqual(90);

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

  // The dialog IS open — this is one of the things it does own.
  await expect(page.getByText("Session options")).toBeVisible();
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
