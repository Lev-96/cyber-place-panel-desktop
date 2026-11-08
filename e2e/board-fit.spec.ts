import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Active Places "no scroll", size, and the list row on a small window
 * (2026-11-03), on the real bundle and CSS:
 *
 *  - with «Без прокрутки» the screen does not scroll while the places fit
 *    (grid and list, 10 seats at the owner's own 1126×926 window);
 *  - with far too many places it stops at 75 % and the page scrolls, every
 *    place still there;
 *  - a list row keeps its one-line look (texts, then the button beside them)
 *    on the smallest desktop window;
 *  - under the zoom a card's button still opens ITS seat, its clock still
 *    runs, and the card is the same element (not remounted).
 */

const isBackend = (url: URL): boolean =>
  url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

interface Floor { seats: number; running: number }

const seed = async (page: Page, floor: Floor, layout: object, board: object | null) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/user/preferences", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ preferences: {
      data: { interface: "custom", theme: "dark", layout }, schema_version: 1, onboarding_version: 1, onboarded_at: null,
    } }),
  }));
  if (board) {
    await page.addInitScript((b) => {
      if (window.localStorage.getItem("u1:cp.ui.board") === null) window.localStorage.setItem("u1:cp.ui.board", JSON.stringify(b));
    }, board);
  }
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: Array.from({ length: floor.seats }, (_, i) => ({
      id: i + 1, branch_id: 1, place_id: 100 + i, label: `PS5 ${i + 1}`, kind: "ps", status: "online", is_startable: true,
      hourly_rate: 1000, current_session_id: i < floor.running ? 500 + i : null,
      place: { id: 100 + i, number: i + 1, name: `Hall ${i + 1}`, type: "standard", platform: "ps5" },
    })) }),
  }));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: Array.from({ length: floor.running }, (_, i) => ({
      id: 500 + i, branch_id: 1, pc_id: i + 1, pc_label: `PS5 ${i + 1}`, mode: "fixed",
      started_at: new Date(Date.now() - 20 * 60_000).toISOString(), ends_at: new Date(Date.now() + 40 * 60_000).toISOString(),
      status: "active", total_paid: 1500, joystick_count: 2, joysticks: [], is_free: false, is_unlimited: false,
      supports_joysticks: true, place_platform: "ps5",
    })) }),
  }));
};

const openBoard = async (page: Page, floor: Floor, layout: object, board: object | null, size = { width: 1126, height: 926 }) => {
  await page.setViewportSize(size);
  await seed(page, floor, layout, board);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(floor.seats);
  await page.waitForTimeout(300); // the fit runs on the next frame(s)
};

const screenFacts = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main.main") as HTMLElement;
    const grid = document.querySelector(".live-grid--sessions") as HTMLElement;
    const cells = Array.from(document.querySelectorAll<HTMLElement>(".live-grid--sessions > .place-cell"));
    return {
      scrolls: main.scrollHeight > main.clientHeight + 1,
      fit: Number(main.style.getPropertyValue("--board-fit") || 1),
      fitGap: main.style.getPropertyValue("--board-fit-gap"),
      zoom: Number(getComputedStyle(grid).zoom || 1),
      cells: cells.length,
      lastBottom: Math.max(...cells.map((c) => c.getBoundingClientRect().bottom)),
      mainBottom: main.getBoundingClientRect().bottom,
      firstWidth: cells[0]?.getBoundingClientRect().width ?? 0,
    };
  });

const LIST = { board_view: "list", density: "standard", card_size: "m" };
const GRID = { board_view: "grid", density: "standard", card_size: "m" };
// «Без прокрутки» (shrinking the board to the window's height) was removed
// with its switch on 2026-11-04 (owner): a long board simply scrolls.
test("a long board scrolls; nothing is shrunk for the height", async ({ page }) => {
  await openBoard(page, { seats: 10, running: 3 }, GRID, null, { width: 1126, height: 700 });
  const f = await screenFacts(page);
  expect(f.scrolls).toBe(true);
  expect(f.zoom).toBe(1);
  expect(f.fitGap).toBe("");
});

test("the list row keeps its one-line look on the smallest window: Start beside the texts", async ({ page }) => {
  await openBoard(page, { seats: 4, running: 1 }, LIST, null, { width: 800, height: 560 });
  const row = await page.evaluate(() => {
    const free = document.querySelectorAll<HTMLElement>(".live-grid--sessions > .place-cell")[2];
    const start = free.querySelector<HTMLElement>(".session-card__start") as HTMLElement;
    const id = free.querySelector<HTMLElement>(".id") as HTMLElement;
    const s = start.getBoundingClientRect();
    const i = id.getBoundingClientRect();
    const c = free.getBoundingClientRect();
    return { startLeft: s.left, idRight: i.right, startTop: s.top, idTop: i.top, cardRight: c.right, startRight: s.right, height: c.height };
  });
  // Beside, not under: the button starts right of the texts, on their lines.
  expect(row.startLeft).toBeGreaterThan(row.idRight);
  expect(row.startTop).toBeLessThan(row.idTop + 40);
  expect(row.startRight).toBeLessThanOrEqual(row.cardRight);
  expect(row.height).toBeLessThan(80); // was 96 with the button on a line of its own
});

test("under the zoom: Start opens ITS seat, the clock runs, the card is the same element", async ({ page }) => {
  // A list too wide for a narrow window, even with pictures: the width fit zooms it.
  await openBoard(page, { seats: 10, running: 3 }, LIST, null, { width: 700, height: 900 });
  expect((await screenFacts(page)).fit).toBeLessThan(1);
  const running = page.locator(".live-grid--sessions > .place-cell").first();
  const marked = await running.evaluate((el) => { (el as HTMLElement & { __probe?: number }).__probe = 42; return true; });
  expect(marked).toBe(true);
  const before = await running.locator(".status").innerText();
  await page.waitForTimeout(2200);
  const after = await running.locator(".status").innerText();
  expect(after).not.toBe(before); // the clock kept running
  expect(await running.evaluate((el) => (el as HTMLElement & { __probe?: number }).__probe)).toBe(42); // not remounted

  const fifth = page.locator(".live-grid--sessions > .place-cell").nth(4);
  await fifth.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("№5");
});

test("a switch lays out as one line: its track, then its words (no class collision)", async ({ page }) => {
  await openBoard(page, { seats: 2, running: 0 }, GRID, null);
  await page.goto("/#/appearance");
  const label = page.getByTestId("board-gap-y-auto").locator("xpath=ancestor::label[1]");
  await expect(label).toBeVisible();
  const box = await label.evaluate((el) => {
    const track = el.querySelector(".cp-switch-track") as HTMLElement;
    const words = el.querySelector(".cp-switch-label") as HTMLElement;
    return { dir: getComputedStyle(el).flexDirection, trackRight: track.getBoundingClientRect().right, wordsLeft: words.getBoundingClientRect().left };
  });
  expect(box.dir).toBe("row");
  expect(box.wordsLeft).toBeGreaterThan(box.trackRight);
});

for (const [name, board] of [["as many as fit", null], ["rows 16px apart", { v: 1, gap_y: 16 }]] as const) {
  test(`the preview lays out like Active Places (${name}): same columns`, async ({ page }) => {
    await openBoard(page, { seats: 4, running: 2 }, GRID, board);
    const columnsIn = (sel: string) => page.evaluate((s) =>
      new Set(Array.from(document.querySelectorAll(s)).map((c) => Math.round((c as HTMLElement).getBoundingClientRect().left))).size, sel);
    const onBoard = await columnsIn(".live-grid--sessions > .place-cell");
    await page.goto("/#/appearance");
    const preview = page.getByTestId("appearance-preview");
    await preview.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    expect(await columnsIn('[data-testid="appearance-preview"] .live-grid--sessions > .place-cell')).toBe(onBoard);
    // At the board's own size (2026-11-03): what the card cannot show scrolls
    // inside the preview's frame; the page itself never scrolls sideways.
    const facts = await preview.evaluate((el) => {
      const frame = el.querySelector(".appearance-preview__frame") as HTMLElement;
      return {
        overflowX: getComputedStyle(frame).overflowX,
        pageScrolls: document.documentElement.scrollWidth > window.innerWidth + 1,
        zoom: Number(getComputedStyle(el.querySelector(".live-grid--sessions") as HTMLElement).zoom || 1),
      };
    });
    expect(facts.overflowX).toBe("auto");
    expect(facts.pageScrolls).toBe(false);
    expect(facts.zoom).toBe(1);
  });
}

/**
 * A row keeps its look after a Start, at EVERY window size (2026-11-03,
 * owner's screenshots and GameZone.html): a running console row is the same
 * one line as a free row — texts, then its buttons on the right — at the same
 * size whatever the window, the side menu open or folded. Nothing is shrunk,
 * rearranged, cut or spilled; a list wider than the window scrolls sideways
 * inside its section, every button reachable.
 */
const rowFacts = (page: Page) =>
  page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>(".live-grid--sessions > .place-cell"));
    const running = cells.find((c) => c.classList.contains("session-card--running")) as HTMLElement;
    const free = cells.find((c) => c.classList.contains("session-card--idle")) as HTMLElement;
    const box = (el: Element) => el.getBoundingClientRect();
    const actions = running.querySelector(".session-card__actions") as HTMLElement;
    const buttons = Array.from(actions.querySelectorAll<HTMLElement>("button"));
    const status = running.querySelector(".status") as HTMLElement;
    const stop = actions.querySelector<HTMLElement>("[data-action=stop]") as HTMLElement;
    const spill = (card: HTMLElement) => Array.from(card.querySelectorAll<HTMLElement>("*"))
      .some((el) => { const b = box(el); return b.width > 0 && (b.right > box(card).right + 1 || b.left < box(card).left - 1); });
    return {
      runningH: Math.round(box(running).height),
      freeH: Math.round(box(free).height),
      widths: [...new Set(cells.map((c) => Math.round(box(c).width)))],
      buttonTops: [...new Set(buttons.map((b) => Math.round(box(b).top)))],
      wordsWhole: [...buttons, ...Array.from(free.querySelectorAll<HTMLElement>("button"))]
        .every((b) => b.scrollWidth <= b.clientWidth + 1),
      actionsLeft: box(actions).left,
      statusRight: box(status).right,
      spillRunning: spill(running),
      spillFree: spill(free),
      // The size things are drawn at, to compare across windows.
      idHeight: Math.round(box(running.querySelector(".id") as HTMLElement).height),
      stopWidth: Math.round(box(stop).width),
      zoom: Number(getComputedStyle(document.querySelector(".live-grid--sessions") as HTMLElement).zoom || 1),
      // Pictures instead of words (2026-11-03): the row was too narrow for them.
      icons: (document.querySelector("main.main") as HTMLElement).hasAttribute("data-board-icons"),
      actions: buttons.map((b) => b.getAttribute("data-action") ?? b.getAttribute("data-testid")),
      picturesShown: buttons.filter((b) => b.classList.contains("session-card__btn") && !b.classList.contains("pad-toggle__btn"))
        .every((b) => {
          const svg = b.querySelector(".session-card__btn-icon");
          const word = b.querySelector(".session-card__btn-text");
          return svg !== null && getComputedStyle(svg).display !== "none"
            && (word === null || getComputedStyle(word).display === "none") && (b.getAttribute("title") ?? "") !== "";
        }),
    };
  });

const UNLIMITED: Floor = { seats: 10, running: 1 };
const unlimitedSession = async (page: Page) => {
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: [{
      id: 500, branch_id: 1, pc_id: 1, mode: "fixed", started_at: new Date(Date.now() - 3 * 60_000).toISOString(),
      ends_at: null, status: "active", is_unlimited: true, is_free: false, hourly_rate: 1000, total_paid: 0,
      joystick_count: 2, joysticks: [], supports_joysticks: true, place_platform: "ps5",
    }] }),
  }));
};

test("list, after a Start: the same one-line row at every window size, always whole", async ({ page }) => {
  test.setTimeout(90_000);
  await unlimitedSession(page);
  await openBoard(page, UNLIMITED, LIST, null, { width: 1920, height: 1080 });
  const reference = await rowFacts(page);
  expect(reference.zoom).toBe(1);
  expect(reference.icons).toBe(false);
  for (const [label, size, fold, whole] of [
    ["800×900, menu folded", { width: 800, height: 900 }, true, true],
    ["1126×926", { width: 1126, height: 926 }, false, true],
    ["1366×768", { width: 1366, height: 768 }, false, true],
    // A 446px list: words do not fit, pictures do with a zoom above the floor.
    ["800×900, menu open", { width: 800, height: 900 }, false, true],
  ] as const) {
    await page.setViewportSize(size);
    const folded = await page.getByTestId("sidebar-toggle").getAttribute("aria-expanded") === "false";
    if (fold !== folded) await page.getByTestId("sidebar-toggle").click();
    await page.waitForTimeout(500);
    const f = await rowFacts(page);
    expect(f.buttonTops.length, `${label}: buttons on one line`).toBe(1);
    expect(f.actionsLeft, `${label}: buttons right of the texts`).toBeGreaterThanOrEqual(f.statusRight - 1);
    expect(Math.abs(f.runningH - f.freeH), `${label}: running ${f.runningH} vs free ${f.freeH}`).toBeLessThanOrEqual(4);
    expect(f.widths.length, `${label}: every row one width`).toBe(1);
    expect(f.wordsWhole, `${label}: no button text cut`).toBe(true);
    expect(f.spillRunning, label).toBe(false);
    expect(f.spillFree, label).toBe(false);
    // Whole: no sideways scroll anywhere.
    const scrolls = await page.evaluate(() => {
      const inner = document.querySelector(".cp-section-inner") as HTMLElement;
      const main = document.querySelector("main.main") as HTMLElement;
      return inner.scrollWidth > inner.clientWidth + 1 || main.scrollWidth > main.clientWidth + 1;
    });
    if (whole) expect(scrolls, `${label}: sideways scroll`).toBe(false);
    // The same buttons in the same order, whatever the width.
    expect(f.actions, `${label}: same buttons, same order`).toEqual(reference.actions);
    // The same row, only in proportion: text scaled by the list's zoom; the
    // buttons too, as words, or as 38px pictures when the words do not fit.
    expect(Math.abs(f.idHeight - reference.idHeight * f.zoom), `${label}: text in proportion`).toBeLessThanOrEqual(2);
    if (f.icons) {
      expect(f.picturesShown, `${label}: pictures, names kept as tooltips`).toBe(true);
      expect(Math.abs(f.stopWidth - 38 * f.zoom), `${label}: picture button in proportion`).toBeLessThanOrEqual(2);
    } else {
      expect(Math.abs(f.stopWidth - reference.stopWidth * f.zoom), `${label}: button in proportion`).toBeLessThanOrEqual(2);
    }
  }
});

test("list, a window wide enough: full size, nothing scaled", async ({ page }) => {
  await unlimitedSession(page);
  await openBoard(page, UNLIMITED, LIST, null, { width: 1600, height: 900 });
  expect((await rowFacts(page)).zoom).toBe(1);
});

test("list, 1126×926, three playing consoles (6 buttons): every button inside the card's frame, none over its padding", async ({ page }) => {
  await openBoard(page, { seats: 10, running: 3 }, LIST, null);
  const worst = await page.evaluate(() => {
    let over = -Infinity;
    for (const card of Array.from(document.querySelectorAll<HTMLElement>(".live-grid--sessions > .session-card--running"))) {
      const cs = getComputedStyle(card);
      const z = card.getBoundingClientRect().width / card.offsetWidth; // the board's zoom, in screen px
      const inner = card.getBoundingClientRect().right - (parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingRight)) * z;
      for (const b of Array.from(card.querySelectorAll<HTMLElement>(".session-card__actions button"))) {
        over = Math.max(over, b.getBoundingClientRect().right - inner);
      }
    }
    return over;
  });
  expect(worst, "px past the card's content edge").toBeLessThanOrEqual(1);
});
