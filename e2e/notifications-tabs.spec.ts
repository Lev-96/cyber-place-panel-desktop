import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * A1 (release regression 2026-11-15): on Notifications an owner with both
 * feeds saw «Active Plac…» / «Активные мес…» and no red count on that tab —
 * the shared `.cp-subtab` rule (equal shares, `min-width: 0`, ellipsis) inside
 * a toolbar whose tab list does not grow. The toolbar's tabs are sized to
 * their words now; every other SectionTabs screen keeps the equal shares.
 * `NOTIFICATION_TABS_SHOTS=<dir>` also writes the toolbar's screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.NOTIFICATION_TABS_SHOTS;

type Lang = "en" | "ru" | "am";
const LANGS: readonly Lang[] = ["en", "ru", "am"];
const WIDTHS = [1920, 1280, 520, 390] as const;
const HEIGHT: Record<(typeof WIDTHS)[number], number> = { 1920: 1080, 1280: 800, 520: 560, 390: 844 };

// `login.title`, `notifications.sessionFeedTitle`, `notifications.billingFeedTitle`.
const SIGN_IN: Record<Lang, string> = { en: "Sign in", ru: "Вход", am: "Մուտք" };
const SEATS: Record<Lang, string> = { en: "Active Places", ru: "Активные места", am: "Ակտիվ տեղեր" };
const BILLING: Record<Lang, string> = { en: "Billing", ru: "Биллинг", am: "Հաշվարկ" };

// One unread row per feed, shaped as `GET /notifications` sends them
// (`SessionEndingSoon::toArray()` and `PlatformBillingNotice::toArray()`).
const seatNotice = {
  id: "n-seat-1",
  type: "App\\Notifications\\SessionEndingSoon",
  read_at: null,
  created_at: "2026-11-14T09:00:00+04:00",
  data: { type: "session.ending_soon", branch_id: 1, session_id: 7, pc_id: 4, place_number: 4, minutes_left: 15, ends_at: "2026-11-14T09:15:00+04:00" },
};
const billingNotice = {
  id: "n-billing-1",
  type: "App\\Notifications\\PlatformBillingNotice",
  read_at: null,
  created_at: "2026-11-14T09:00:00+04:00",
  data: {
    type: "platform_billing.due_today", invoice_id: 31, company_id: 1, company_name: "QA",
    period_start: "2026-10-01", period_end: "2026-10-31", amount: "100.00", balance: "100.00", currency: "AMD",
    due_on: "2026-11-14", effective_due_on: "2026-11-14", days_overdue: 0, billing_access: "active",
  },
};

const signInOwner = async (page: Page, lang: Lang, width: (typeof WIDTHS)[number]) => {
  await page.setViewportSize({ width, height: HEIGHT[width] });
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/notifications", (r) => r.fulfill(json({
    data: [seatNotice, billingNotice],
    meta: { current_page: 1, last_page: 1, per_page: 50, total: 2, unread_count: 2 },
  })));
  await page.route((u) => isBackend(u) && u.pathname === "/notifications/unread-count", (r) => r.fulfill(json({ unread_count: 2 })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: SIGN_IN[lang], exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
};

const measureToolbar = (page: Page) => page.evaluate(() => {
  const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  const toolbar = document.querySelector(".notifications-toolbar") as HTMLElement;
  const readAll = toolbar.querySelector(".notifications-toolbar__read-all") as HTMLElement | null;
  const tabs = Array.from(toolbar.querySelectorAll<HTMLElement>('[role="tab"]')).map((tab) => {
    const badge = tab.querySelector<HTMLElement>(".cp-subtab__badge");
    return {
      text: tab.innerText.replace(/\s+/g, " ").trim(),
      scrollWidth: tab.scrollWidth,
      clientWidth: tab.clientWidth,
      box: box(tab),
      badge: badge ? { box: box(badge), visibility: getComputedStyle(badge).visibility, display: getComputedStyle(badge).display } : null,
    };
  });
  return {
    tabs,
    toolbar: box(toolbar),
    toolbarOverflow: toolbar.scrollWidth - toolbar.clientWidth,
    readAll: readAll ? box(readAll) : null,
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    innerWidth: window.innerWidth,
  };
});

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`${lang} ${width}: both tab labels whole, both badges shown, «Mark all as read» on the right`, async ({ page }) => {
      await signInOwner(page, lang, width);
      await page.goto("/#/notifications");
      const tabs = page.locator(".notifications-toolbar").getByRole("tab");
      await expect(tabs).toHaveCount(2);
      await expect(page.locator(".notifications-toolbar .cp-subtab__badge")).toHaveCount(2);
      const readAllBtn = page.locator(".notifications-toolbar__read-all");
      await expect(readAllBtn).toBeVisible();
      // Before the measuring, so a failing run still leaves its picture.
      if (SHOTS) await page.locator(".notifications-toolbar").screenshot({ path: `${SHOTS}/tabs_${lang}_${width}.png` });

      const m = await measureToolbar(page);
      const labels = [SEATS[lang], BILLING[lang]];
      m.tabs.forEach((tab, i) => {
        const where = `${lang} ${width} tab ${i}`;
        // The whole word, nothing cut: no ellipsis, no hidden overflow.
        expect(tab.text, where).toContain(labels[i]);
        expect(tab.scrollWidth, `${where}: ${tab.scrollWidth} > ${tab.clientWidth}`).toBeLessThanOrEqual(tab.clientWidth);
        // The red count is drawn, and inside its tab.
        expect(tab.badge, where).not.toBeNull();
        const b = tab.badge!;
        expect(b.visibility, where).toBe("visible");
        expect(b.box.width, where).toBeGreaterThan(0);
        expect(b.box.height, where).toBeGreaterThan(0);
        expect(b.box.left, where).toBeGreaterThanOrEqual(tab.box.left - 0.5);
        expect(b.box.right, where).toBeLessThanOrEqual(tab.box.right + 0.5);
        expect(b.box.top, where).toBeGreaterThanOrEqual(tab.box.top - 0.5);
        expect(b.box.bottom, where).toBeLessThanOrEqual(tab.box.bottom + 0.5);
        // The tab keeps its usual height (`--subtab-h`, 34px by default)
        // wherever the label fits one line; in the 108px column a 390px
        // window leaves beside the side menu the label wraps and the tab grows.
        if (width >= 520) expect(Math.round(tab.box.height), where).toBe(34);
        else expect(Math.round(tab.box.height), where).toBeGreaterThanOrEqual(34);
        // And stays inside the window.
        expect(tab.box.right, where).toBeLessThanOrEqual(m.innerWidth);
      });
      // Side by side where there is room; one under the other when not.
      if (width >= 1280) expect(m.tabs[0].box.top).toBe(m.tabs[1].box.top);
      else expect(m.tabs[1].box.top === m.tabs[0].box.top || m.tabs[1].box.top >= m.tabs[0].box.bottom).toBe(true);

      // «Mark all as read» visible, in the toolbar's right corner, in the window.
      expect(m.readAll).not.toBeNull();
      expect(Math.abs(m.readAll!.right - m.toolbar.right), `${lang} ${width} read-all right edge`).toBeLessThanOrEqual(1);
      expect(m.readAll!.right).toBeLessThanOrEqual(m.innerWidth);
      // Next to the tabs when it fits, else cleanly under them — never on top.
      const lastTab = m.tabs[1].box;
      const sameRow = m.readAll!.top < lastTab.bottom && m.readAll!.bottom > lastTab.top;
      if (sameRow) expect(m.readAll!.left).toBeGreaterThan(lastTab.right);
      else expect(m.readAll!.top).toBeGreaterThanOrEqual(lastTab.bottom);

      // The button's look is the feed's small button, as before A1 (it was an
      // inline style); only a window ≤ 420px takes 4px off its sides.
      await expect(readAllBtn).toHaveCSS("font-size", "12px");
      await expect(readAllBtn).toHaveCSS("border-top-color", "rgb(31, 42, 68)");
      await expect(readAllBtn).toHaveCSS("padding", width > 420 ? "4px 10px" : "4px 6px");

      // Nothing past any edge.
      expect(m.toolbarOverflow, `${lang} ${width} toolbar overflow`).toBeLessThanOrEqual(0);
      expect(m.pageOverflow, `${lang} ${width} page overflow`).toBeLessThanOrEqual(0);
    });
  }
}

test("the toolbar tabs keep tab semantics: ← → move the selection", async ({ page }) => {
  await signInOwner(page, "en", 1280);
  await page.goto("/#/notifications");
  const seats = page.getByRole("tab", { name: /Active Places/ });
  const billing = page.getByRole("tab", { name: /Billing/ });
  await expect(seats).toHaveAttribute("aria-selected", "true");
  await seats.focus();
  await page.keyboard.press("ArrowRight");
  await expect(billing).toHaveAttribute("aria-selected", "true");
  await expect(billing).toBeFocused();
  // The active one keeps the primary look (`Button` drops `secondary`).
  await expect(billing).not.toHaveClass(/\bsecondary\b/);
  await expect(seats).toHaveClass(/\bsecondary\b/);
  await page.keyboard.press("ArrowLeft");
  await expect(seats).toHaveAttribute("aria-selected", "true");
});

test("other SectionTabs screens are unchanged: Products tabs keep equal shares and the ellipsis", async ({ page }) => {
  await signInOwner(page, "en", 1280);
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => r.fulfill(json({
    branch: { id: 1, name: "Hall", company_id: 1, price_for_branch: { id: 1, branch_id: 1 } },
  })));
  await page.goto("/#/branches/1/products");
  const tablist = page.getByRole("tablist").last();
  await expect(tablist.getByRole("tab")).toHaveCount(2);
  const styles = await tablist.evaluate((list) => Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).map((tab) => {
    const cs = getComputedStyle(tab);
    return {
      flexGrow: cs.flexGrow, flexShrink: cs.flexShrink, flexBasis: cs.flexBasis, minWidth: cs.minWidth,
      display: cs.display, overflow: cs.overflowX, textOverflow: cs.textOverflow, whiteSpace: cs.whiteSpace,
      width: tab.getBoundingClientRect().width, height: tab.getBoundingClientRect().height,
    };
  }));
  for (const s of styles) {
    expect(s).toMatchObject({
      flexGrow: "1", flexShrink: "1", flexBasis: "0px", minWidth: "0px",
      display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    });
    expect(Math.round(s.height)).toBe(34);
  }
  // Equal shares of the line (the inactive tab's 1px border each side is the
  // only difference: 479 / 481 at 1280 before and after A1).
  expect(Math.abs(styles[0].width - styles[1].width)).toBeLessThanOrEqual(2);
});
