import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Active Places from 1920 down to 520px wide (owner, 2026-11-03), on the real
 * bundle and CSS. The order and places of everything stay as on a large
 * screen: no mobile rearrangement. When a list row is too narrow for its
 * buttons' words, the same buttons show pictures (names kept as tooltips);
 * only then is the list scaled as a whole. And the interface preview draws a
 * seat at exactly the board's size and style.
 *
 * Checked at every width: the page never scrolls sideways; nothing leaves its
 * card or overlaps; the buttons are one line, in the same order, each one
 * visible and the thing under its own centre (clickable); no text is cut.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

const seed = async (page: Page, view: "list" | "grid", running = 3, seats = 6) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/user/preferences", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ preferences: {
      data: { interface: "custom", theme: "dark", layout: { board_view: view, density: "standard", card_size: "m" } },
      schema_version: 1, onboarding_version: 1, onboarded_at: null,
    } }),
  }));
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: Array.from({ length: seats }, (_, i) => ({
      id: i + 1, branch_id: 1, place_id: 100 + i, label: `PS5 ${i + 1}`, kind: "ps", status: "online", is_startable: true,
      hourly_rate: 1000, current_session_id: i < running ? 500 + i : null,
      place: { id: 100 + i, number: i + 1, name: `Hall ${i + 1}`, type: "standard", platform: "ps5" },
    })) }),
  }));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: Array.from({ length: running }, (_, i) => ({
      id: 500 + i, branch_id: 1, pc_id: i + 1, pc_label: `PS5 ${i + 1}`, mode: "fixed",
      // The second one in its last minutes, like the preview's sample seat:
      // an ending seat's frame is thicker, so the widest row is the same.
      started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
      ends_at: new Date(Date.now() + (i === 1 ? 4 : 40) * 60_000).toISOString(),
      status: "active", hourly_rate: 800, total_paid: 0, joystick_count: 2, joysticks: [], is_free: false, is_unlimited: false,
      supports_joysticks: true, place_platform: "ps5",
    })) }),
  }));
};

const open = async (page: Page, view: "list" | "grid", width = 1920) => {
  await page.setViewportSize({ width, height: 1000 });
  await seed(page, view);
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".live-grid--sessions .place-cell")).toHaveCount(6);
  await page.waitForTimeout(300);
};

const setMenu = async (page: Page, folded: boolean) => {
  const toggle = page.getByTestId("sidebar-toggle");
  if ((await toggle.getAttribute("aria-expanded") === "false") !== folded) await toggle.click();
  await page.waitForTimeout(400);
};

/** Everything the rules above say, measured at the current width. */
const facts = (page: Page) => page.evaluate(() => {
  const box = (el: Element) => el.getBoundingClientRect();
  const main = document.querySelector("main.main") as HTMLElement;
  const inner = document.querySelector(".cp-section-inner") as HTMLElement;
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".live-grid--sessions > .place-cell"));
  const problems: string[] = [];
  for (const card of cards) {
    const c = box(card);
    const parts = Array.from(card.children).filter((el) => {
      const b = box(el);
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden" && !el.classList.contains("cell-grip");
    });
    for (const el of card.querySelectorAll<HTMLElement>("*")) {
      const b = box(el);
      if (b.width > 0 && (b.right > c.right + 1 || b.left < c.left - 1)) { problems.push(`spill ${el.className}`); break; }
    }
    for (let i = 0; i < parts.length; i += 1) {
      for (let j = i + 1; j < parts.length; j += 1) {
        const a = box(parts[i]); const b = box(parts[j]);
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) problems.push(`overlap ${parts[i].className} / ${parts[j].className}`);
      }
    }
    for (const t of card.querySelectorAll<HTMLElement>(".id, .status")) {
      if (t.scrollWidth > t.clientWidth + 1) problems.push(`cut ${t.className}`);
    }
  }
  const running = cards.find((c) => c.classList.contains("session-card--running")) as HTMLElement;
  const buttons = Array.from(running.querySelectorAll<HTMLElement>(".session-card__actions button"));
  for (const b of buttons) {
    const r = box(b);
    if (r.right > window.innerWidth || r.left < 0) problems.push(`off screen ${b.getAttribute("data-action")}`);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !(hit === b || b.contains(hit))) problems.push(`covered ${b.getAttribute("data-action") ?? b.getAttribute("data-testid")}`);
  }
  return {
    pageScrolls: document.documentElement.scrollWidth > window.innerWidth + 1 || main.scrollWidth > main.clientWidth + 1,
    sectionScrolls: inner.scrollWidth > inner.clientWidth + 1,
    zoom: Number(getComputedStyle(document.querySelector(".live-grid--sessions") as HTMLElement).zoom || 1),
    icons: main.hasAttribute("data-board-icons"),
    oneLine: new Set(buttons.map((b) => Math.round(box(b).top))).size === 1,
    order: buttons.map((b) => b.getAttribute("data-action") ?? b.getAttribute("data-testid")),
    problems,
  };
});

const WIDTHS = [1920, 1440, 1024, 768, 640, 520];

test("list: 1920 -> 520, every 20px and at each named width, menu folded: whole, same order, nothing cut, covered or overlapping", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "list");
  await setMenu(page, true);
  const reference = await facts(page);
  expect(reference.icons).toBe(false);
  const sweep = [...new Set([...WIDTHS, ...Array.from({ length: 71 }, (_, i) => 1920 - i * 20)])].sort((a, b) => b - a);
  let sawIcons = false;
  for (const width of sweep) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(120);
    const f = await facts(page);
    const at = `${width}px`;
    expect(f.pageScrolls, `${at}: page scrolls sideways`).toBe(false);
    expect(f.sectionScrolls, `${at}: list scrolls sideways (zoom ${f.zoom})`).toBe(false);
    expect(f.problems, at).toEqual([]);
    expect(f.oneLine, `${at}: buttons on one line`).toBe(true);
    expect(f.order, `${at}: same buttons, same order`).toEqual(reference.order);
    expect(f.zoom, `${at}: never below the readable floor`).toBeGreaterThanOrEqual(0.5);
    sawIcons ||= f.icons;
  }
  // The pictures step was actually reached on the way down.
  expect(sawIcons).toBe(true);
});

test("list, menu open, at each named width: the page never scrolls sideways and nothing is cut, covered or overlapping", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, "list");
  await setMenu(page, false);
  const reference = await facts(page);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(150);
    const f = await facts(page);
    expect(f.pageScrolls, `${width}px: page scrolls sideways`).toBe(false);
    expect(f.order, `${width}px: same order`).toEqual(reference.order);
    // Whole unless even the pictures at the floor do not fit the room the
    // open menu leaves (520px: the menu alone takes 240 of it). Then the list
    // (only) scrolls inside its section: buttons past its edge are reached by
    // that scroll, so only "past the edge" is allowed, nothing else.
    if (f.zoom > 0.5) {
      expect(f.sectionScrolls, `${width}px: list scrolls (zoom ${f.zoom})`).toBe(false);
      expect(f.problems, `${width}px`).toEqual([]);
    } else {
      expect(f.problems.filter((p) => !p.startsWith("off screen") && !p.startsWith("covered")), `${width}px`).toEqual([]);
    }
  }
});

test("grid: 1920 -> 520 at each named width: cards wrap, the page never scrolls sideways, nothing spills or overlaps", async ({ page }) => {
  await open(page, "grid");
  await setMenu(page, true);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(150);
    const f = await page.evaluate(() => {
      const main = document.querySelector("main.main") as HTMLElement;
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".live-grid--sessions > .place-cell"));
      const spill = cards.some((c) => {
        const r = c.getBoundingClientRect();
        return Array.from(c.querySelectorAll<HTMLElement>("*")).some((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1);
        });
      });
      return {
        pageScrolls: document.documentElement.scrollWidth > window.innerWidth + 1 || main.scrollWidth > main.clientWidth + 1,
        spill,
        icons: main.hasAttribute("data-board-icons"),
        narrowest: Math.min(...cards.map((c) => c.getBoundingClientRect().width)),
      };
    });
    expect(f.pageScrolls, `${width}px`).toBe(false);
    expect(f.spill, `${width}px`).toBe(false);
    // Grid cards wrap instead: never pictures, never narrower than a card.
    expect(f.icons, `${width}px`).toBe(false);
    expect(f.narrowest, `${width}px`).toBeGreaterThanOrEqual(197);
  }
});

/** A seat's look, part by part, as computed styles and sizes. */
const look = (page: Page, root: string) => page.evaluate((sel) => {
  const scope = document.querySelector(sel) as HTMLElement;
  const card = scope.querySelector(".live-grid--sessions > .session-card--running") as HTMLElement;
  const pick = (el: Element | null) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      padding: cs.padding, borderRadius: cs.borderRadius, borderColor: cs.borderTopColor,
      color: cs.color, background: cs.backgroundColor,
      height: Math.round(r.height), width: Math.round(r.width),
    };
  };
  return {
    card: pick(card),
    state: pick(card.querySelector(".session-card__state")),
    platform: pick(card.querySelector(".platform")),
    id: pick(card.querySelector(".id")),
    status: pick(card.querySelector(".status")),
    stop: pick(card.querySelector("[data-action=stop]")),
    pause: pick(card.querySelector("[data-action=pause]")),
    pad: pick(card.querySelector(".pad-toggle__btn")),
    icons: (card.closest("[data-board-icons]") !== null),
  };
}, root);

for (const view of ["list", "grid"] as const) {
  for (const [width, folded] of [[1440, true], [800, false]] as const) {
    test(`the preview draws a playing seat exactly as Active Places (${view}, ${width}px${folded ? "" : ", menu open"})`, async ({ page }) => {
      await open(page, view, width);
      await setMenu(page, folded);
      const board = await look(page, "main.main");
      await page.goto("/#/appearance");
      const preview = page.getByTestId("appearance-preview");
      await preview.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const pic = await look(page, '[data-testid="appearance-preview"]');
      // Not the clock's digits or the name's length (sample data): its size, type, colours and frame.
      for (const part of ["card", "state", "platform", "id", "status", "stop", "pause", "pad"] as const) {
        const a = board[part]; const b = pic[part];
        expect(b, `${part} drawn`).not.toBeNull();
        // A grid card stretches to the tallest card in its row, which is the
        // sample data's doing, not the look's: its height is not compared.
        const skipHeight = view === "grid" && part === "card";
        expect({ ...b, width: undefined, height: skipHeight ? undefined : b!.height }, `${view} ${width}: ${part}`)
          .toEqual({ ...a, width: undefined, height: skipHeight ? undefined : a!.height });
      }
      // Buttons, card and frame widths: the same pixels.
      for (const part of ["card", "stop", "pause", "pad"] as const) {
        expect(pic[part]!.width, `${view} ${width}: ${part} width`).toBe(board[part]!.width);
      }
      expect(pic.icons, `${view} ${width}: words or pictures`).toBe(board.icons);
    });
  }
}

// Two full rows of seats in the preview on any screen and card size
// (2026-11-05), so the space between rows can always be seen.
for (const w of [1366, 1920, 2560]) {
  test(`the preview draws exactly two rows of cards at ${w}px, and again after a card-size change`, async ({ page }) => {
    await open(page, "grid", w);
    await page.setViewportSize({ width: w, height: 1000 });
    await page.goto("/#/appearance");
    await expect(page.getByTestId("appearance-preview-block")).toBeVisible();
    const shape = () => page.evaluate(() => {
      const g = document.querySelector('[data-testid="appearance-preview-block"] .live-grid--sessions') as HTMLElement;
      const cells = Array.from(g.querySelectorAll<HTMLElement>(":scope > .place-cell"));
      const tops = cells.map((c) => Math.round(c.getBoundingClientRect().top));
      const rows = [...new Set(tops)];
      return { cols: getComputedStyle(g).gridTemplateColumns.split(" ").length, cells: cells.length, rows: rows.length,
        full: rows.every((r) => tops.filter((x) => x === r).length === tops.filter((x) => x === rows[0]).length) };
    });
    const check = async () => {
      await expect.poll(async () => (await shape()).rows).toBe(2);
      const s = await shape();
      expect(s.full, JSON.stringify(s)).toBe(true);
      expect(s.cells).toBe(Math.min(24, Math.max(4, s.cols * 2)));
      return s;
    };
    const medium = await check();
    await page.getByRole("tab", { name: "Small", exact: true }).click();
    const small = await check();
    expect(small.cols).toBeGreaterThanOrEqual(medium.cols);
  });
}

test("the preview lives in «Карточки активных мест»: in sight while its settings are changed, gone with the section", async ({ page }) => {
  await open(page, "grid", 1366);
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto("/#/appearance");
  const dock = page.getByTestId("appearance-preview-block");
  await expect(dock).toBeVisible();
  const facts = () => page.evaluate(() => {
    const d = document.querySelector('[data-testid="appearance-preview-block"]') as HTMLElement;
    const r = d.getBoundingClientRect();
    const bar = (document.querySelector(".cp-topbar") as HTMLElement).getBoundingClientRect();
    const cards = document.querySelector('[data-testid="appearance-cards"]') as HTMLElement;
    const grid = d.querySelector(".live-grid--sessions") as HTMLElement | null;
    const tops = grid ? [...new Set(Array.from(grid.querySelectorAll<HTMLElement>(":scope > .place-cell")).map((c) => Math.round(c.getBoundingClientRect().top)))].sort((a, b) => a - b) : [];
    return {
      top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), barBottom: Math.round(bar.bottom),
      inSection: (d.closest("section") as HTMLElement).contains(cards),
      cards: d.querySelectorAll(".place-cell").length,
      rows: tops.length,
      rowGap: grid ? getComputedStyle(grid).rowGap : "",
    };
  });
  // In the cards section, not above every section.
  expect((await facts()).inSection).toBe(true);
  // Two rows of cards, so the space between rows can be seen.
  expect((await facts()).rows).toBeGreaterThanOrEqual(2);

  // Focus brought to the row-spacing switch (Tab, a click on its label):
  // the page scrolls it to just below the stuck preview, never behind it.
  await page.evaluate(() => { (document.querySelector("main.main") as HTMLElement).scrollTop = 0; });
  await page.getByTestId("board-gap-y-auto").focus();
  await page.waitForTimeout(200);
  const focused = await page.evaluate(() => {
    const sw = document.querySelector('[data-testid="board-gap-y-auto"]')!.closest("label") as HTMLElement;
    const dock = document.querySelector('[data-testid="appearance-preview-block"]') as HTMLElement;
    return { label: Math.round(sw.getBoundingClientRect().top), dock: Math.round(dock.getBoundingClientRect().bottom) };
  });
  expect(focused.label, JSON.stringify(focused)).toBeGreaterThanOrEqual(focused.dock);
  // The slider (auto off) scrolled to near the window's bottom, as a person
  // scrolling down to it would: the preview is stuck right under the top
  // bar, and the slider is on screen below it — both seen at once.
  const slider = page.getByTestId("board-gap-y-slider");
  await page.getByTestId("board-gap-y-auto").locator("xpath=ancestor::label[1]").click();
  await expect(slider).toBeVisible();
  await page.evaluate(() => {
    const main = document.querySelector("main.main") as HTMLElement;
    const r = document.querySelector('[data-testid="board-gap-y-slider"]')!.getBoundingClientRect();
    main.scrollTop += r.bottom - (window.innerHeight - 40);
  });
  await page.waitForTimeout(200);
  const both = await facts();
  expect(both.top, JSON.stringify(both)).toBeGreaterThanOrEqual(both.barBottom);
  expect(both.height).toBeLessThanOrEqual(800 * 0.55);
  const sliderBox = await slider.boundingBox();
  expect(sliderBox!.y).toBeGreaterThan(both.bottom);
  expect(sliderBox!.y + sliderBox!.height).toBeLessThan(800);
  // Further down the section (its top long gone above the bar): the preview
  // stays stuck right under the top bar.
  await page.evaluate(() => {
    const main = document.querySelector("main.main") as HTMLElement;
    const dock = document.querySelector('[data-testid="appearance-preview-block"]') as HTMLElement;
    const end = document.querySelector('[data-testid="appearance-cards"]')!.getBoundingClientRect().bottom;
    main.scrollTop += end - (dock.getBoundingClientRect().height + 160);
  });
  await page.waitForTimeout(200);
  const stuck = await facts();
  expect(stuck.top).toBeGreaterThanOrEqual(stuck.barBottom);
  expect(stuck.top - stuck.barBottom, JSON.stringify(stuck)).toBeLessThanOrEqual(20);
  await page.evaluate(() => document.querySelector('[data-testid="board-gap-y-slider"]')!.scrollIntoView({ block: "end" }));
  // Dragging it changes the preview live, while both are on screen.
  await slider.fill("16");
  expect((await facts()).rowGap).toBe("16px");
  await slider.fill("56");
  expect((await facts()).rowGap).toBe("56px");

  // The next section: the preview has left with its own.
  await page.evaluate(() => {
    const home = document.querySelector('[data-testid="appearance-home"]') as HTMLElement;
    home.closest("section")!.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(200);
  const after = await facts();
  expect(after.bottom).toBeLessThanOrEqual(after.barBottom + 1);

  // Hidden on request, and back.
  await page.getByTestId("appearance-cards").scrollIntoViewIfNeeded();
  await page.getByTestId("appearance-preview-toggle").click();
  expect((await facts()).cards).toBe(0);
  await page.getByTestId("appearance-preview-toggle").click();
  expect((await facts()).cards).toBeGreaterThan(0);
});
