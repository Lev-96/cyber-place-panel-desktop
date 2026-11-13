import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * «Интерфейс и тема» → side menu order by drag and drop (2026-11-13), on the
 * real bundle and CSS: a mouse at 1280 and a real finger (CDP touch events,
 * the ones a phone sends) at 390 with the menu folded, as on the owner web.
 *
 * Proven here: a drag reorders and the page reports unsaved changes; Escape
 * mid-drag puts everything back; dragging at the bottom edge scrolls the
 * page; a finger swipe on a row's BODY scrolls the page and reorders
 * nothing, while the same finger on the grip drags.
 *
 * Screenshots go to `CP_SHOTS` when it is set (the visual record of a run).
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const SHOTS = process.env.CP_SHOTS ? path.resolve(process.env.CP_SHOTS.replace(/^~/, os.homedir())) : null;
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const open = async (page: Page, width: number, height: number) => {
  await page.setViewportSize({ width, height });
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/user/preferences", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ preferences: { data: null, schema_version: 1, onboarding_version: 1, onboarded_at: null } }),
  }));
  // The shared mocks do not answer the owner's platform-billing overview (the
  // catch-all body has no `current_period`, and the shell's debt card throws
  // on it); "not available" is an answer the panel handles.
  await page.route((u) => isBackend(u) && /^\/company\/\d+\/platform-billing$/.test(u.pathname), (r) => r.fulfill({
    status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not found" }),
  }));
  await page.goto("/#/appearance");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  if (!page.url().includes("#/appearance")) await page.goto("/#/appearance");
  await expect(page.getByTestId("menu-editor")).toBeVisible();
};

const order = (page: Page) =>
  page.$$eval('[data-testid^="menu-row-"]', (els) => els.map((e) => (e as HTMLElement).dataset.testid?.slice("menu-row-".length) ?? ""));
const centreOf = async (page: Page, testId: string) => {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`${testId} is not laid out`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const mainScroll = (page: Page) => page.evaluate(() => document.querySelector("main.main")?.scrollTop ?? -1);
/** Puts the editor's top row a little below the pinned bar. */
const editorToTop = (page: Page) => page.evaluate(() => {
  const main = document.querySelector("main.main");
  const list = document.querySelector('[data-testid="menu-editor"]');
  if (main && list) main.scrollTop += list.getBoundingClientRect().top - 120;
});

test.describe("with a mouse, 1280", () => {
  test("a drag reorders, with the slot shown mid-drag", async ({ page }) => {
    await open(page, 1280, 800);
    await editorToTop(page);
    const before = await order(page);
    const moved = before[1];
    const start = await centreOf(page, `menu-grip-${moved}`);
    const target = await centreOf(page, `menu-row-${before[4]}`);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, target.y + 4, { steps: 12 });
    await page.waitForTimeout(260); // the others finish sliding
    await expect(page.getByTestId(`menu-row-${moved}`)).toHaveAttribute("data-sort-state", "lifted");
    await expect(page.getByTestId(`menu-row-${before[4]}`)).toHaveAttribute("data-sort-state", "shift-up");
    await expect(page.getByTestId("menu-editor")).toHaveAttribute("data-sorting", "pointer");
    // The lifted row is under the pointer, by translate.
    const lifted = await page.getByTestId(`menu-row-${moved}`).boundingBox();
    expect(Math.abs((lifted?.y ?? 0) + (lifted?.height ?? 0) / 2 - (target.y + 4))).toBeLessThan(8);
    await shot(page, "desktop-1280-mid-drag");
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await order(page);
    expect(after).toEqual([before[0], before[2], before[3], before[4], moved, ...before.slice(5)]);
    await expect(page.getByText("Changes are not saved yet")).toBeVisible();
    await expect(page.getByTestId(`menu-row-${moved}`)).not.toHaveAttribute("data-sort-settling", "");
    await shot(page, "desktop-1280-after-drop");
  });

  test("Escape mid-drag puts everything back", async ({ page }) => {
    await open(page, 1280, 800);
    await editorToTop(page);
    const before = await order(page);
    const start = await centreOf(page, `menu-grip-${before[0]}`);
    const target = await centreOf(page, `menu-row-${before[3]}`);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, target.y + 4, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await order(page)).toEqual(before);
    await expect(page.getByText("Changes are not saved yet")).toHaveCount(0);
  });

  test("holding a dragged row at the bottom edge scrolls the page", async ({ page }) => {
    await open(page, 1280, 800);
    await editorToTop(page);
    const before = await order(page);
    const scrolled = await mainScroll(page);
    const start = await centreOf(page, `menu-grip-${before[0]}`);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, 795, { steps: 10 });
    await page.waitForTimeout(700);
    expect(await mainScroll(page)).toBeGreaterThan(scrolled + 40);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await order(page);
    expect(after).not.toEqual(before);
    expect(after.indexOf(before[0])).toBeGreaterThan(0);
  });

  test("the keyboard reorders from the grip", async ({ page }) => {
    await open(page, 1280, 800);
    await editorToTop(page);
    const before = await order(page);
    await page.getByTestId(`menu-grip-${before[0]}`).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    expect(await order(page)).toEqual([before[1], before[2], before[0], ...before.slice(3)]);
    await expect(page.getByTestId(`menu-grip-${before[0]}`)).toBeFocused();
  });
});

test.describe("with a finger, 390 (owner web size)", () => {
  test.use({ hasTouch: true, isMobile: true });

  const touch = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    return async (from: { x: number; y: number }, to: { x: number; y: number }, hold?: () => Promise<void>) => {
      await send("touchStart", from.x, from.y);
      const steps = 14;
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
        await page.waitForTimeout(16);
      }
      if (hold) await hold();
      await send("touchEnd", to.x, to.y);
    };
  };

  const openPhone = async (page: Page) => {
    await open(page, 390, 844);
    // The owner web has no side column on a phone; the folded rail is the closest here.
    const toggle = page.getByTestId("sidebar-toggle");
    if (await toggle.getAttribute("aria-expanded") === "true") await toggle.click();
    await page.waitForTimeout(400);
    await editorToTop(page);
  };

  test("a swipe on a row's body scrolls the page and moves nothing", async ({ page }) => {
    await openPhone(page);
    const before = await order(page);
    const scrolled = await mainScroll(page);
    const body = page.getByTestId(`menu-row-${before[3]}`).locator(".menu-editor__name");
    const b = await body.boundingBox();
    if (!b) throw new Error("row body not laid out");
    const drag = await touch(page);
    await drag({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + b.width / 2, y: b.y + b.height / 2 - 260 });
    await page.waitForTimeout(500);
    expect(await mainScroll(page)).toBeGreaterThan(scrolled + 100);
    expect(await order(page)).toEqual(before);
    // Only the grip blocks scrolling.
    expect(await page.getByTestId(`menu-grip-${before[3]}`).evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
    expect(await page.getByTestId(`menu-row-${before[3]}`).evaluate((el) => getComputedStyle(el).touchAction)).toBe("auto");
  });

  test("a finger on the grip drags the row to a new place", async ({ page }) => {
    await openPhone(page);
    const before = await order(page);
    const scrolled = await mainScroll(page);
    const start = await centreOf(page, `menu-grip-${before[0]}`);
    const target = await centreOf(page, `menu-row-${before[3]}`);
    const drag = await touch(page);
    await drag(start, { x: start.x, y: target.y + 4 }, async () => {
      await page.waitForTimeout(260);
      await expect(page.getByTestId(`menu-row-${before[0]}`)).toHaveAttribute("data-sort-state", "lifted");
      await shot(page, "phone-390-chromium-touch-mid-drag");
    });
    await page.waitForTimeout(300);
    expect(await order(page)).toEqual([before[1], before[2], before[3], before[0], ...before.slice(4)]);
    // The page did not scroll under the finger while it dragged.
    expect(Math.abs((await mainScroll(page)) - scrolled)).toBeLessThan(2);
    await shot(page, "phone-390-chromium-touch-after-drop");
  });
});
