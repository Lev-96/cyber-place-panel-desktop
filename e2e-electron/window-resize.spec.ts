import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The desktop window shrinks freely (owner, 2026-11-04: "without limits"),
 * in REAL Electron: down to its 520px base on every screen, Active Places
 * included — the board no longer holds it wider. The list keeps itself whole
 * instead (pictures for its buttons' words, then a zoom), and the page never
 * scrolls sideways. Only Electron can prove this: a browser has no window
 * minimum.
 */
const isBackend = (url: URL): boolean => url.protocol.startsWith("http");

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

/** The window's own base minimum (electron/windowBounds.ts MIN_CONTENT.width). */
const BASE = 520;

const launch = async (view: "list" | "grid") => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-panel-resize-"));
  fs.writeFileSync(path.join(userDataDir, "cyberplace.kv.json"), JSON.stringify({
    "cp.lang": JSON.stringify("en"),
    "cp.lang.chosen": JSON.stringify(true),
    "u1:cp.lang": JSON.stringify("en"),
  }));
  app = await electron.launch({
    args: [path.join(__dirname, ".."), `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DEV_URL: "", ELECTRON_DEVTOOLS: "" },
  });
  page = await app.firstWindow();
  const user = { id: 1, name: "Owner One", email: "o@o", role: "company_owner" };
  const now = Date.now();
  await page.route((url) => isBackend(url), async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/user/me") return json({ user: { ...user, dashboard: { branch_id: null, company_id: 1 } } });
    if (p === "/session/login") return json({ login: user, token: "t", messages: "ok" });
    if (p === "/user/preferences") {
      return json({ preferences: {
        data: { interface: "custom", theme: "dark", layout: { board_view: view } },
        schema_version: 1, onboarding_version: 1, onboarded_at: null,
      } });
    }
    if (p === "/pcs") {
      return json({ data: [1, 2, 3].map((n) => ({
        id: n, branch_id: 1, place_id: 10 + n, label: `PS5 ${n}`, kind: "ps", status: "online", is_startable: true,
        current_session_id: n === 1 ? 5 : null,
        place: { id: 10 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "ps5" },
      })) });
    }
    if (p === "/sessions") {
      // A console with an end: its row carries every button (pad, item, time, pause, move, stop).
      return json({ data: [{
        id: 5, branch_id: 1, pc_id: 1, mode: "fixed", status: "active",
        started_at: new Date(now - 20 * 60_000).toISOString(), ends_at: new Date(now + 40 * 60_000).toISOString(),
        hourly_rate: 1000, total_paid: 0, joystick_count: 2, joysticks: [], is_free: false, is_unlimited: false,
        supports_joysticks: true, place_platform: "ps5",
      }] });
    }
    return json({ data: [], meta: { total: 0 } });
  });
  await page.reload();
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
};

/** The main process's own view of the window. */
const windowFacts = () => app.evaluate(({ BrowserWindow, screen }) => {
  const win = BrowserWindow.getAllWindows()[0];
  const [outerW] = win.getSize();
  const [innerW] = win.getContentSize();
  return {
    min: win.getMinimumSize()[0],
    frame: outerW - innerW,
    contentWidth: innerW,
    workArea: screen.getDisplayMatching(win.getBounds()).workArea.width,
  };
});

/** Make the window as narrow as it will let itself be. */
const squeeze = () => app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows()[0];
  win.unmaximize();
  const [, h] = win.getSize();
  win.setSize(1, h);
});

test.afterEach(async () => {
  await app?.close();
  if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
});

for (const view of ["list", "grid"] as const) {
  test(`Active Places (${view}): one squeeze takes the window down to the 520px base`, async () => {
    await launch(view);
    await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });
    await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(3);
    await page.waitForTimeout(600);
    // The board asks nothing of the window: its minimum is the base.
    const before = await windowFacts();
    expect(before.min).toBe(BASE + before.frame);
    await squeeze();
    await expect.poll(async () => (await windowFacts()).contentWidth, { timeout: 5000 }).toBe(BASE);
    expect((await windowFacts()).min).toBe(BASE + before.frame);
  });
}

test("at 520 with the menu folded: the list is whole, in pictures, and the page never scrolls sideways", async () => {
  await launch("list");
  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions"; });
  await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(3);
  await squeeze();
  await expect.poll(async () => (await windowFacts()).contentWidth, { timeout: 5000 }).toBe(BASE);
  const toggle = page.getByTestId("sidebar-toggle");
  if (await toggle.getAttribute("aria-expanded") !== "false") await toggle.click();
  await expect.poll(() => page.evaluate(() => {
    const inner = document.querySelector(".cp-section-inner") as HTMLElement;
    return inner.scrollWidth - inner.clientWidth;
  }), { timeout: 5000 }).toBeLessThanOrEqual(1);
  const f = await page.evaluate(() => {
    const main = document.querySelector("main.main") as HTMLElement;
    const running = document.querySelector(".live-grid--sessions > .session-card--running") as HTMLElement;
    const buttons = Array.from(running.querySelectorAll<HTMLElement>(".session-card__actions button"));
    return {
      pageScrolls: document.documentElement.scrollWidth > window.innerWidth + 1 || main.scrollWidth > main.clientWidth + 1,
      icons: main.hasAttribute("data-board-icons"),
      zoom: Number(getComputedStyle(document.querySelector(".live-grid--sessions") as HTMLElement).zoom || 1),
      oneLine: new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size === 1,
      reachable: buttons.every((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return r.right <= window.innerWidth && hit !== null && (hit === b || b.contains(hit));
      }),
    };
  });
  expect(f.pageScrolls).toBe(false);
  expect(f.icons).toBe(true);
  expect(f.zoom).toBeGreaterThanOrEqual(0.5);
  expect(f.oneLine).toBe(true);
  expect(f.reachable).toBe(true);
});

test("the window-minimum bridge is gone: nothing in the page can size the window", async () => {
  await launch("grid");
  const exposed = await page.evaluate(() => "cyberplaceWindow" in window);
  expect(exposed).toBe(false);
});
