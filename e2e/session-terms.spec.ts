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
 *   - the pad count on a tile reads "N / 4", so "can another player join this
 *     seat?" is answerable without opening anything;
 *   - waiving a bill is drawn for an owner and NOT for a manager. The server
 *     asserts the same capability, so this is not the enforcement — it is the
 *     half a person sees, and a manager who can see the checkbox will press it
 *     and get a 403 they cannot act on.
 */

const isBackend = (url: URL): boolean =>
  url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

const PLACE = { id: 10, number: 1, name: "PS5 VIP", type: "standard", platform: "ps5" };

const FREE_PLACE = { id: 11, number: 2, name: "PC-1", type: "standard", platform: "pc" };

/** One console, one session on it, three pads in play — the server's numbers. */
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
            joystick_count: 3, joysticks: [], is_free: false, is_unlimited: false,
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

test("the tile says how many pads out of the maximum", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");

  await expect(page.getByText("3 / 4")).toBeVisible();
});

test("an owner is offered the Free control on a running session", async ({ page }) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await signIn(page, "o@o");
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");
  await page.getByRole("button", { name: "Options" }).first().click();

  await expect(page.getByText("Free session", { exact: true })).toBeVisible();
});

test("a manager is not", async ({ page }) => {
  await installBackendMocks(page, {
    role: "manager", company_id: 1, branch_id: 1, name: "Manager One",
  });
  await seedFloor(page);
  await signIn(page, "m@m");
  await expect(page.getByText("Manager One").first()).toBeVisible();

  await page.goto("/#/branches/1/sessions");
  await page.getByRole("button", { name: "Options" }).first().click();

  // The dialog IS open — the manager keeps joysticks, time and unlimited.
  await expect(page.getByText("Joysticks", { exact: true })).toBeVisible();
  // …and only the bill waiver is absent.
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
 * And a manager cannot — the same rule as the running-session waiver, because
 * it is the same decision. The server asserts `sessions.free` on POST /sessions
 * too, so this is the half a person sees rather than the enforcement.
 */
test("a manager cannot start one free", async ({ page }) => {
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
  await expect(page.getByText("Free session", { exact: true })).toHaveCount(0);
});
