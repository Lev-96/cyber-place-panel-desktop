import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The panel, running in the runtime it actually ships in.
 *
 * Everything the browser suite proves is application code. This proves the
 * SHELL around it, which is where a change can break in ways Chromium never
 * sees: the `app://` protocol serving the bundle, the preload bridge, the CSP,
 * and — the reason this file exists at all — that the confirmation on
 * "switch to unlimited" is an in-app React modal.
 *
 * A native `window.confirm()` in Electron poisons the renderer's keyboard focus
 * on Linux WMs: the NEXT modal's inputs silently stop accepting keystrokes, so
 * the action that appears broken is never the one that broke it. That is not
 * observable in a browser, where `confirm` is merely auto-dismissed by
 * Playwright. Here it is: a native dialog would block the main process, and the
 * assertions below would time out instead of finding a React dialog.
 */

const isBackend = (url: URL): boolean => url.protocol.startsWith("http");

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
/** The seat the routes answer with, so a test can re-answer with its own. */
let session: Record<string, unknown>;

/**
 * A THROWAWAY profile, and this is not a nicety.
 *
 * Unpackaged Electron defaults to the developer's real `userData` directory —
 * their saved language, their saved emails, their auth token. The first run of
 * this file came up in Russian with two real addresses autofilled, because it
 * was reading a person's actual profile. A test must never do that: it reads
 * private data, and it makes the result depend on whose machine it ran on.
 *
 * Note also that the KV store here is a FILE reached through the preload
 * bridge, not `localStorage` — so the browser suite's seeding does nothing in
 * Electron, and the language gate would sit over everything. Values are stored
 * JSON-encoded, exactly as `KeyValueStore.set` writes them.
 */
const seedProfile = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-panel-e2e-"));
  fs.writeFileSync(
    path.join(dir, "cyberplace.kv.json"),
    JSON.stringify({
      "cp.lang": JSON.stringify("en"),
      "cp.lang.chosen": JSON.stringify(true),
      "u1:cp.lang": JSON.stringify("en"),
    }),
  );

  return dir;
};

test.beforeEach(async () => {
  userDataDir = seedProfile();
  app = await electron.launch({
    args: [path.join(__dirname, ".."), `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      // Force the packaged load path (app://), not a dev server.
      ELECTRON_DEV_URL: "",
      // Detached DevTools poison renderer focus too; the app gates them.
      ELECTRON_DEVTOOLS: "",
    },
  });
  page = await app.firstWindow();

  const user = { id: 1, name: "Owner One", email: "o@o", role: "company_owner" };
  const dashboard = { branch_id: null, company_id: 1 };

  /**
   * A PlayStation with one extra pad out, on a club that allows both joystick
   * strategies and has not handed anything over yet.
   *
   * The counts are the ones the current model produces and not free numbers: a
   * PlayStation comes with a kit of TWO controllers nobody hands over, so a
   * seat holding one extra reads three in play and names the extra `3/4` —
   * `3/4` because this venue prices the pair as one figure, which is what
   * `joystick_rule.shared` says.
   */
  session = {
    id: 5, branch_id: 1, pc_id: 1, pc_label: "PS5 VIP", mode: "fixed",
    started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 40 * 60_000).toISOString(),
    status: "active", total_paid: 1500, joystick_count: 3,
    joysticks: [{
      id: 9, slot: 3, price: 500, is_charged: true, is_hourly: false,
      started_at: new Date(Date.now() - 10 * 60_000).toISOString(), stopped_at: null,
    }],
    joystick_rule: {
      included: 2, price: 500, price_4: null, max: 4, max_slot: 4,
      charged_slots: [3, 4], hourly: false, shared: true,
      options: [{ slot: 3, price: 500, shared: true }, { slot: 4, price: 500, shared: true }],
    },
    joystick_strategy: "fixed",
    is_free: false, is_unlimited: false, supports_joysticks: true,
    place_platform: "ps5",
  };

  await page.route((url) => isBackend(url), async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/user/me") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ user: { ...user, dashboard } }),
      });
    }
    if (p === "/session/login") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ login: user, token: "t", messages: "ok" }),
      });
    }
    if (p === "/pcs") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [{
          id: 1, branch_id: 1, place_id: 10, label: "PS5 VIP", kind: "ps",
          status: "online", is_startable: true, current_session_id: 5,
          place: { id: 10, number: 1, name: "PS5 VIP", type: "standard", platform: "ps5" },
        }] }),
      });
    }
    if (p === "/sessions") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [session] }),
      });
    }
    if (p === "/products") {
      // The add-a-product dialog only draws its search box when the branch has
      // a catalogue — and that search box is what this file types into.
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [
          { id: 1, branch_id: 1, name: "Cola", category: "drinks", price: 500, is_active: true },
        ] }),
      });
    }
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { total: 0 } }),
    });
  });

  await page.reload();
});

test.afterEach(async () => {
  await app?.close();
  if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
});

/** The shell itself: the bundle is served, and it is served over app://. */
test("the window loads the bundle over the app:// protocol", async () => {
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(page.url()).toContain("app://");
});

/** The preload bridge is present and is exactly the contracted surface. */
test("the preload exposes its bridges and nothing node-shaped", async () => {
  const shape = await page.evaluate(() => ({
    desktopAPI: typeof (window as never as Record<string, unknown>).desktopAPI,
    updates: typeof (window as never as Record<string, unknown>).cyberplaceUpdates,
    // The renderer must never reach Node.
    require: typeof (window as never as Record<string, unknown>).require,
    process: typeof (window as never as Record<string, unknown>).process,
  }));

  expect(shape.desktopAPI).toBe("object");
  expect(shape.updates).toBe("object");
  expect(shape.require).toBe("undefined");
  expect(shape.process).toBe("undefined");
});

test("the changed session screens render in Electron", async () => {
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });

  // The pad line NAMES the extra rather than counting to a ceiling: `3/4`,
  // because this venue prices the third and the fourth as one figure.
  await expect(page.getByText("3/4").first()).toBeVisible();
  // …and the charge line names it too, at the fee it froze.
  await expect(page.getByText(/Joystick #3/)).toBeVisible();
});

/**
 * The one that could only ever be proven here.
 *
 * A native `confirm()` blocks Electron's renderer until it is answered. If this
 * dialog were still native, the React text below would never appear and the
 * input check after it could not run at all.
 */
test("the unlimited confirmation is an in-app dialog, and the renderer keeps typing", async () => {
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });
  // The tile lost its "Options" button; this dialog is reached by the name a
  // cashier actually scans for on a seat that is running out.
  await page.getByRole("button", { name: "Add time" }).first().click();

  // Ticked AND priced, or the apply button stays disabled: the price a seat
  // carries on at is now always entered deliberately.
  // Clicked the way a cashier clicks it — on the label. The input itself sits
  // behind the styled box, so targeting it directly is a click no human makes.
  await page.getByText("Switch to unlimited", { exact: true }).click();
  await page.getByLabel("Price per hour").fill("1200");
  await page.getByRole("button", { name: "Change fixed tariff to unlimited" }).click();

  // A React dialog, in the DOM — not an OS window.
  await expect(page.getByText("Switch this session to unlimited?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  // And now the part the native call actually broke: the NEXT modal's input.
  // A `window.confirm()` leaves the renderer unable to accept keystrokes after
  // it is dismissed, and the symptom appears here rather than on the dialog
  // that caused it — which is why this types into a DIFFERENT dialog opened
  // afterwards, and asserts the characters landed.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Add a product" }).first().click();

  const search = page.getByPlaceholder("Search by name…");
  await expect(search).toBeVisible();
  await search.fill("cola");
  await expect(search).toHaveValue("cola");
});

/**
 * The seat whose extra controllers are ONE payment, in the shell it ships in.
 *
 * The money rule is the server's and the unit tests pin the component; what
 * only Electron can show is that a cashier looking at the real bundle sees WHY
 * a controller is about to be handed over for nothing. A zero with no reason
 * beside it is read as a fault and phoned in as one.
 */
test("a seat whose fee was already charged says so, in Electron", async () => {
  const paid = {
    ...session,
    joystick_rule: {
      included: 2, price: 500, price_4: null, max: 4, max_slot: 4,
      charged_slots: [3, 4], hourly: false, shared: true,
      charge_once: true, fee_taken: true,
      // Priced by the server at what the next pad will actually cost.
      options: [{ slot: 4, price: 0, shared: true }],
    },
  };

  await page.route((url) => isBackend(url), async (route) => {
    if (new URL(route.request().url()).pathname === "/sessions") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [paid] }),
      });
    }
    return route.fallback();
  });
  await page.reload();

  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();

  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });

  // On the pad line, without pressing anything…
  await expect(page.getByText("fee already charged").first()).toBeVisible();

  // …and the control is the SWITCH this venue gets instead of a menu: one
  // payment, one controller, and with it out the button offers its return.
  await expect(page.getByLabel("Joysticks")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove joystick" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add joystick" })).toHaveCount(0);
});
