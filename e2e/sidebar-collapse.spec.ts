import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Folding the side menu to an icon rail (2026-11-03), on the real bundle and
 * the real CSS.
 *
 * The unit tests prove the state and that nothing the shell keeps alive is
 * remounted. What only a browser can show is geometry and motion: the page
 * really takes the room, it gets there through in-between widths (no snap),
 * the rail still shows the menu (logo, icons, Support, avatar) centred on one
 * axis, nothing peeks past its edge, nothing scrolls sideways, the rail can
 * be used from the mouse and the keyboard, and reduced motion skips the fold.
 */

const RAIL = 64;
const OPEN = 240;

const isBackend = (url: URL): boolean =>
  url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

/** A board with two seats, so Active Places has cards to reflow. */
const seedFloor = async (page: Page) => {
  await page.route(
    (url) => isBackend(url) && url.pathname === "/pcs",
    (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [1, 2].map((n) => ({
          id: n, branch_id: 1, place_id: 10 + n, label: `PC-${n}`, kind: "pc",
          status: "online", is_startable: true, hourly_rate: 1000,
          place: { id: 10 + n, number: n, name: `PC-${n}`, type: "standard", platform: "pc" },
        })),
      }),
    }),
  );
};

const signIn = async (page: Page) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.getByText("PC-1").first()).toBeVisible();
};

/**
 * Wait until the page has stopped talking to the network for `quietMs`.
 *
 * The full load of the board (re)opens the Reverb socket, and the private
 * channels authorise in one burst of `/broadcasting/auth` right after it opens
 * (measured: one burst ~0.3 s after open, then nothing for 20 s, with no
 * toggle at all). Measuring before that burst has passed would blame the
 * toggle for the socket's start-up.
 */
const networkQuiet = async (page: Page, quietMs = 1000, maxMs = 10_000) => {
  let last = Date.now();
  const onRequest = () => { last = Date.now(); };
  page.on("request", onRequest);
  const start = Date.now();
  while (Date.now() - last < quietMs && Date.now() - start < maxMs) {
    await page.waitForTimeout(100);
  }
  page.off("request", onRequest);
};

const toggle = (page: Page) => page.getByTestId("sidebar-toggle");

const geometry = (page: Page) =>
  page.evaluate(() => {
    const centre = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return r ? r.left + r.width / 2 : NaN;
    };
    const main = document.querySelector("main.main") as HTMLElement;
    const aside = document.querySelector("aside.sidebar") as HTMLElement;
    const doc = document.documentElement;
    const logout = aside.querySelector(".logout") as HTMLElement;
    return {
      mainLeft: main.getBoundingClientRect().left,
      mainWidth: main.getBoundingClientRect().width,
      asideRight: aside.getBoundingClientRect().right,
      asideVisibility: getComputedStyle(aside).visibility,
      navIconCentres: Array.from(aside.querySelectorAll(".sidebar-nav .nav-icon")).map(centre),
      supportCentre: centre(aside.querySelector(".nav-support-card__icon")),
      avatarCentre: centre(aside.querySelector(".user-card > :first-child")),
      logoCentre: centre(aside.querySelector("h1 img")),
      labelOpacity: Math.max(...Array.from(aside.querySelectorAll(".nav-label")).map((l) => Number(getComputedStyle(l).opacity))),
      logoutVisibility: getComputedStyle(logout).visibility,
      viewport: window.innerWidth,
      sideScroll: doc.scrollWidth > doc.clientWidth || document.body.scrollWidth > document.body.clientWidth,
      mainSideScroll: main.scrollWidth > main.clientWidth,
    };
  });

/** Wait out the 240ms fold plus a frame of slack. */
const settle = (page: Page) => page.waitForTimeout(400);

test("folds to a rail and back: the page takes the room, smoothly, with nothing scrolling sideways", async ({ page }) => {
  await signIn(page);
  const url = page.url();

  const open = await geometry(page);
  expect(open.mainLeft).toBe(OPEN);
  expect(open.asideRight).toBe(OPEN);
  expect(open.labelOpacity).toBe(1);
  expect(open.logoutVisibility).toBe("visible");
  expect(open.sideScroll).toBe(false);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

  // No request of any kind is caused by folding or unfolding the menu: once
  // the socket's start-up burst is over, the toggles must add nothing at all.
  await networkQuiet(page);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  await toggle(page).click();
  // Mid-fold: an in-between width, never a jump straight to the end.
  await page.waitForTimeout(100);
  const mid = await geometry(page);
  expect(mid.mainLeft).toBeGreaterThan(RAIL);
  expect(mid.mainLeft).toBeLessThan(OPEN);
  // The menu's edge is the column's edge: no gap, no overlap.
  expect(Math.abs(mid.asideRight - mid.mainLeft)).toBeLessThanOrEqual(1);

  await settle(page);
  const rail = await geometry(page);
  expect(rail.mainLeft).toBe(RAIL);
  expect(rail.mainWidth).toBe(rail.viewport - RAIL);
  expect(rail.asideRight).toBe(RAIL);
  expect(rail.asideVisibility).toBe("visible");
  expect(rail.sideScroll).toBe(false);
  expect(rail.mainSideScroll).toBe(false);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  expect(page.url()).toBe(url);

  await toggle(page).click();
  await settle(page);
  const back = await geometry(page);
  expect(back.mainLeft).toBe(OPEN);
  expect(back.asideRight).toBe(OPEN);
  expect(back.labelOpacity).toBe(1);
  expect(back.logoutVisibility).toBe("visible");
  expect(back.sideScroll).toBe(false);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  expect(page.url()).toBe(url);

  expect(requests, requests.join(" ")).toEqual([]);
});

test("the rail shows the menu: icons, Support, avatar and logo on one axis; nothing peeks past the edge", async ({ page }) => {
  await signIn(page);
  await toggle(page).click();
  await settle(page);
  const g = await geometry(page);

  const axis = RAIL / 2;
  expect(g.navIconCentres.length).toBeGreaterThan(3);
  for (const c of g.navIconCentres) expect(Math.abs(c - axis)).toBeLessThanOrEqual(2);
  expect(Math.abs(g.supportCentre - axis)).toBeLessThanOrEqual(2);
  expect(Math.abs(g.avatarCentre - axis)).toBeLessThanOrEqual(2);
  expect(Math.abs(g.logoCentre - axis)).toBeLessThanOrEqual(2);
  // The labels' first letters would show in the rail: they are faded out.
  expect(g.labelOpacity).toBe(0);
  // Sign-out sits past the edge: out of sight AND out of the Tab order.
  expect(g.logoutVisibility).toBe("hidden");

  // Each entry names itself on hover.
  const bookings = page.locator('nav.sidebar-nav a[href="#/bookings"]');
  await expect(bookings).toHaveAttribute("title", "Bookings");
});

test("a rail entry navigates and the menu stays folded", async ({ page }) => {
  await signIn(page);
  await toggle(page).click();
  await settle(page);
  // Where a person clicks: the icon tile. The row's centre is past the rail's
  // edge, and the clipped part does not take clicks meant for the page.
  await page.locator('nav.sidebar-nav a[href="#/bookings"]').click({ position: { x: 20, y: 20 } });
  await expect(page).toHaveURL(/#\/bookings$/);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  expect((await geometry(page)).mainLeft).toBe(RAIL);
});

test("from the keyboard: the toggle works, rail entries are reachable, sign-out is not", async ({ page }) => {
  await signIn(page);
  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await settle(page);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(toggle(page)).toBeFocused();

  let reachedRail = false;
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press("Shift+Tab");
    const where = await page.evaluate(() => ({
      inRail: !!document.activeElement?.closest("aside.sidebar"),
      logout: !!document.activeElement?.closest(".logout"),
    }));
    expect(where.logout).toBe(false);
    reachedRail ||= where.inRail;
  }
  expect(reachedRail).toBe(true);

  await toggle(page).focus();
  await page.keyboard.press("Space");
  await settle(page);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
});

test("reduced motion: the menu folds at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await toggle(page).click();
  // Two frames, far short of the 240ms fold.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect((await geometry(page)).mainLeft).toBe(RAIL);
});

for (const size of [{ width: 800, height: 560 }, { width: 1920, height: 1080 }]) {
  test(`no sideways scroll either way at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await signIn(page);
    expect((await geometry(page)).sideScroll).toBe(false);
    await toggle(page).click();
    await settle(page);
    const g = await geometry(page);
    expect(g.mainWidth).toBe(size.width - RAIL);
    expect(g.sideScroll).toBe(false);
    expect(g.mainSideScroll).toBe(false);
  });
}
