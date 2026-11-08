import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * How the Active Places buttons are labelled (owner, 2026-11-04), on the real
 * bundle and CSS: "Both" (words, pictures when a list row is too narrow — as
 * before), "Icons" (pictures always, list and grid) and "Text" (words always;
 * a list too narrow is scaled instead). The full name stays the tooltip.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

const open = async (page: Page, view: "list" | "grid", labels: "auto" | "icons" | "text", width: number) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  const json = (b: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  await page.route((u) => isBackend(u) && u.pathname === "/user/preferences", (r) => r.fulfill(json({ preferences: {
    data: { interface: "custom", theme: "dark", layout: { board_view: view, density: "standard", card_size: "m", button_labels: labels } },
    schema_version: 1, onboarding_version: 1, onboarded_at: null,
  } })));
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2, 3].map((n) => ({
    id: n, branch_id: 1, place_id: 10 + n, label: `PS5 ${n}`, kind: "ps", status: "online", is_startable: true,
    current_session_id: n === 1 ? 501 : null, place: { id: 10 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "ps5" },
  })) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: [{
    id: 501, branch_id: 1, pc_id: 1, mode: "fixed", status: "active", started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 40 * 60_000).toISOString(), hourly_rate: 800, total_paid: 0, joystick_count: 2, joysticks: [],
    supports_joysticks: true, place_platform: "ps5", is_free: false, is_unlimited: false,
  }] })));
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".place-cell")).toHaveCount(3);
  await page.waitForTimeout(400);
};

/** On the running seat: which buttons show a picture, which a word, and their names. */
const buttons = (page: Page) => page.evaluate(() => {
  const card = document.querySelector(".session-card--running") as HTMLElement;
  const main = document.querySelector("main.main") as HTMLElement;
  const btns = Array.from(card.querySelectorAll<HTMLElement>(".session-card__btn:not(.pad-toggle__btn)"));
  const shown = (el: Element | null) => el !== null && getComputedStyle(el).display !== "none";
  return {
    pictures: btns.filter((b) => shown(b.querySelector(".session-card__btn-icon"))).length,
    words: btns.filter((b) => shown(b.querySelector(".session-card__btn-text"))).length,
    named: btns.every((b) => (b.getAttribute("title") ?? "") !== "" && (b.getAttribute("aria-label") ?? "") !== ""),
    count: btns.length,
    pageScrolls: document.documentElement.scrollWidth > window.innerWidth + 1 || main.scrollWidth > main.clientWidth + 1,
  };
});

test("Both, wide list: words; narrow list: pictures (as before)", async ({ page }) => {
  await open(page, "list", "auto", 1600);
  const wide = await buttons(page);
  expect(wide.words).toBe(wide.count);
  expect(wide.pictures).toBe(0);
  await page.setViewportSize({ width: 760, height: 900 });
  await page.waitForTimeout(300);
  const narrow = await buttons(page);
  expect(narrow.pictures).toBe(narrow.count);
  expect(narrow.words).toBe(0);
});

test("Icons: pictures even on a wide list, names kept", async ({ page }) => {
  await open(page, "list", "icons", 1600);
  const b = await buttons(page);
  expect(b.pictures).toBe(b.count);
  expect(b.words).toBe(0);
  expect(b.named).toBe(true);
});

test("Icons: pictures on grid cards too, inside their cells", async ({ page }) => {
  await open(page, "grid", "icons", 1440);
  const b = await buttons(page);
  expect(b.pictures).toBe(b.count);
  expect(b.words).toBe(0);
  expect(b.named).toBe(true);
});

test("Text: words even on a list too narrow for them — the list is scaled, the page never scrolls sideways", async ({ page }) => {
  await open(page, "list", "text", 760);
  const b = await buttons(page);
  expect(b.words).toBe(b.count);
  expect(b.pictures).toBe(0);
  expect(b.pageScrolls).toBe(false);
  const zoom = await page.evaluate(() => Number(getComputedStyle(document.querySelector(".live-grid--sessions") as HTMLElement).zoom || 1));
  expect(zoom).toBeLessThan(1);
});
