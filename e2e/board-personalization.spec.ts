import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * The Active Places grid of «Мой интерфейс» (2026-11-03), on the real bundle
 * and the real CSS: a fixed number of columns that holds across window sizes
 * (fewer only when they cannot fit, never a card narrower than its minimum,
 * never a reorder), measured spacing, a card that still does what it did, and
 * all of it back after a reload.
 */

const isBackend = (url: URL): boolean =>
  url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

const SEATS = 9;

const seedFloor = async (page: Page) => {
  await page.route(
    (url) => isBackend(url) && url.pathname === "/pcs",
    (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: Array.from({ length: SEATS }, (_, i) => {
          const n = i + 1;
          return {
            id: n, branch_id: 1, place_id: 100 + n, label: `PC-${n}`, kind: "pc",
            status: "online", is_startable: true, hourly_rate: 1000,
            place: { id: 100 + n, number: n, name: `PC-${n}`, type: "standard", platform: "pc" },
          };
        }),
      }),
    }),
  );
};

/** «Мой интерфейс» on the server, and this computer's board. */
const seedInterface = async (page: Page, board: object | null) => {
  await page.route(
    (url) => isBackend(url) && url.pathname === "/user/preferences",
    (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferences: {
        data: board ? { interface: "custom", theme: "dark" } : null,
        schema_version: 1, onboarding_version: 1, onboarded_at: null,
      } }),
    }),
  );
  if (board) {
    await page.addInitScript((b) => {
      if (window.localStorage.getItem("u1:cp.ui.board") === null) {
        window.localStorage.setItem("u1:cp.ui.board", JSON.stringify(b));
      }
    }, board);
  }
};

const openBoard = async (page: Page, board: object | null) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await seedFloor(page);
  await seedInterface(page, board);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(SEATS);
};

/** Every card of the first grid: its number, box, and the grid's own facts. */
const layoutOf = (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector(".live-grid.live-grid--sessions") as HTMLElement;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .place-cell"));
    const boxes = cards.map((c) => {
      const r = c.getBoundingClientRect();
      return { n: c.querySelector(".id")?.textContent?.trim() ?? "", left: Math.round(r.left), top: Math.round(r.top), right: r.right, bottom: r.bottom, width: r.width };
    });
    const lefts = [...new Set(boxes.map((b) => b.left))].sort((a, b) => a - b);
    const tops = [...new Set(boxes.map((b) => b.top))].sort((a, b) => a - b);
    // Reading order: row by row, left to right.
    const reading = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left).map((b) => b.n);
    const main = document.querySelector("main.main") as HTMLElement;
    return {
      columns: lefts.length,
      rows: tops.length,
      domOrder: boxes.map((b) => b.n),
      reading,
      minWidth: Math.min(...boxes.map((b) => b.width)),
      gridMin: parseFloat(getComputedStyle(grid).getPropertyValue("--grid-min")) || 198,
      gapX: boxes.length > 1 && boxes[1].top === boxes[0].top ? Math.round(boxes[1].left - boxes[0].right) : null,
      gapY: tops.length > 1 ? Math.round(tops[1] - Math.max(...boxes.filter((b) => b.top === tops[0]).map((b) => b.bottom))) : null,
      sideScroll: main.scrollWidth > main.clientWidth || document.documentElement.scrollWidth > document.documentElement.clientWidth,
      overflowRight: boxes.some((b) => b.right > grid.getBoundingClientRect().right + 0.5),
    };
  });

/**
 * Only the space between rows is the person's own since 2026-11-04 (owner):
 * the column count and the side spacing are gone, and a board kept by an
 * older build with them is drawn as the standard columns and side spacing.
 */
test("the rows are as far apart as chosen; the columns and the side spacing are the standard ones", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // A board kept by an older build, with side spacing and three columns in it.
  await openBoard(page, { v: 1, gap_x: 16, gap_y: 24, columns: 3 });
  const g = await layoutOf(page);
  expect(g.gapY).toBe(24);
  expect(g.gapX).toBe(42); // the density's own, not the 16 kept
  expect(g.columns).toBeGreaterThan(3); // as many as fit, not the 3 kept

  await page.evaluate(() => { document.documentElement.style.setProperty("--board-gap-y", "8px"); });
  const tight = await layoutOf(page);
  expect(tight.gapY).toBe(8);
  expect(tight.sideScroll).toBe(false);
});

test("the standard board is untouched: as many columns as fit, the density's own spacing", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openBoard(page, null);
  const g = await layoutOf(page);
  expect(g.columns).toBeGreaterThan(3);
  expect(g.gapX).toBe(42); // --gap-grid, standard density
  const attrs = await page.evaluate(() => ({
    cols: document.documentElement.dataset.boardCols ?? null,
    gy: document.documentElement.style.getPropertyValue("--board-gap-y"),
  }));
  expect(attrs).toEqual({ cols: null, gy: "" });
});

test("a card still does what it did: Start opens its dialog for that seat", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openBoard(page, { v: 1, gap_y: 8 });
  const third = page.locator(".live-grid--sessions > .place-cell").nth(2);
  await expect(third.locator(".id")).toContainText("№3");
  await third.getByRole("button", { name: "Start", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The dialog is for THIS seat: the third card opens №3. The title is
  // «Start seat» since 4aece84 (2026-11-08, `session.start`).
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Start seat · №3");
});

test("after a reload the board comes back as it was saved", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openBoard(page, { v: 1, gap_y: 24 });
  expect((await layoutOf(page)).gapY).toBe(24);
  await page.reload();
  await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(SEATS);
  expect((await layoutOf(page)).gapY).toBe(24);
});
