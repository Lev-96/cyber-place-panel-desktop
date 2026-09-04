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
        body: JSON.stringify({ data: [{
          id: 5, branch_id: 1, pc_id: 1, pc_label: "PS5 VIP", mode: "fixed",
          started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
          ends_at: new Date(Date.now() + 40 * 60_000).toISOString(),
          status: "active", total_paid: 1500, joystick_count: 3, joysticks: [],
          is_free: false, is_unlimited: false, supports_joysticks: true,
          place_platform: "ps5",
        }] }),
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

  await expect(page.getByText("3 / 4")).toBeVisible();
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
  await page.getByRole("button", { name: "Options" }).first().click();
  await page.getByRole("button", { name: "Switch to unlimited" }).click();

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
