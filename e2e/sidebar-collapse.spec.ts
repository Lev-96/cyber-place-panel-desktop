import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Hiding the side menu (2026-11-03), on the real bundle and the real CSS.
 *
 * The unit tests prove the state and that nothing the shell keeps alive is
 * remounted. What only a browser can show is geometry and motion: the page
 * really takes the menu's room, it gets there through in-between widths (no
 * snap), nothing scrolls sideways, the hidden menu cannot be tabbed into, and
 * reduced motion skips the slide.
 */

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

const toggle = (page: Page) => page.getByTestId("sidebar-toggle");

const geometry = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main.main") as HTMLElement;
    const aside = document.querySelector("aside.sidebar") as HTMLElement;
    const doc = document.documentElement;
    return {
      mainLeft: main.getBoundingClientRect().left,
      mainWidth: main.getBoundingClientRect().width,
      asideRight: aside.getBoundingClientRect().right,
      asideVisibility: getComputedStyle(aside).visibility,
      viewport: window.innerWidth,
      sideScroll: doc.scrollWidth > doc.clientWidth || document.body.scrollWidth > document.body.clientWidth,
      mainSideScroll: main.scrollWidth > main.clientWidth,
    };
  });

/** Wait out the 240ms slide plus a frame of slack. */
const settle = (page: Page) => page.waitForTimeout(400);

test("hides and shows the menu: the page takes the room, smoothly, with nothing scrolling sideways", async ({ page }) => {
  await signIn(page);
  const url = page.url();

  const open = await geometry(page);
  expect(open.mainLeft).toBe(240);
  expect(open.asideRight).toBe(240);
  expect(open.sideScroll).toBe(false);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");

  // No request of any kind is caused by hiding or showing the menu.
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  await toggle(page).click();
  // Mid-slide: an in-between width, never a jump straight to the end.
  await page.waitForTimeout(100);
  const mid = await geometry(page);
  expect(mid.mainLeft).toBeGreaterThan(0);
  expect(mid.mainLeft).toBeLessThan(240);
  // The menu's edge rides the column's edge: no gap, no overlap.
  expect(Math.abs(mid.asideRight - mid.mainLeft)).toBeLessThanOrEqual(1);

  await settle(page);
  const hidden = await geometry(page);
  expect(hidden.mainLeft).toBe(0);
  expect(hidden.mainWidth).toBe(hidden.viewport);
  expect(hidden.asideRight).toBeLessThanOrEqual(0);
  expect(hidden.asideVisibility).toBe("hidden");
  expect(hidden.sideScroll).toBe(false);
  expect(hidden.mainSideScroll).toBe(false);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(toggle(page)).toBeVisible();
  expect(page.url()).toBe(url);

  await toggle(page).click();
  await settle(page);
  const back = await geometry(page);
  expect(back.mainLeft).toBe(240);
  expect(back.asideRight).toBe(240);
  expect(back.asideVisibility).toBe("visible");
  expect(back.sideScroll).toBe(false);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  expect(page.url()).toBe(url);

  expect(requests).toEqual([]);
});

test("the hidden menu cannot be tabbed into; the toggle works from the keyboard", async ({ page }) => {
  await signIn(page);
  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await settle(page);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(toggle(page)).toBeFocused();

  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("aside.sidebar"))).toBe(false);
  }

  await toggle(page).focus();
  await page.keyboard.press("Space");
  await settle(page);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
});

test("reduced motion: the menu goes and comes back at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await toggle(page).click();
  // Two frames, far short of the 240ms slide.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect((await geometry(page)).mainLeft).toBe(0);
});

for (const size of [{ width: 800, height: 560 }, { width: 1920, height: 1080 }]) {
  test(`no sideways scroll either way at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await signIn(page);
    expect((await geometry(page)).sideScroll).toBe(false);
    await toggle(page).click();
    await settle(page);
    const g = await geometry(page);
    expect(g.mainWidth).toBe(size.width);
    expect(g.sideScroll).toBe(false);
    expect(g.mainSideScroll).toBe(false);
  });
}
