import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { installBackendMocks, platformBillingOverview, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * The owner's «Общая задолженность Cyber Place Platform» card on the dashboard
 * (owner, 2026-11-15): on a narrower window «Подробнее» lay on top of the text.
 * At every width, in every language, nothing the card says may sit under the
 * button, and nothing may leave the card: the text rectangles (per line, from
 * a Range, so a block's empty right side does not count) never meet the
 * button's box. Run with a long sentence (overdue, access limited) and with
 * the quiet one (nothing owed), and with an eight-digit debt.
 *
 * `CP_SHOTS_DIR` set: a screenshot of the card per case is written there.
 */

const isBackend = (u: URL) => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
const SHOTS = process.env.CP_SHOTS_DIR;

type Lang = "en" | "ru" | "am";
const LANGS: Lang[] = ["en", "ru", "am"];
const SIGN_IN: Record<Lang, string> = { en: "Sign in", ru: "Вход", am: "Մուտք" };
/**
 * The desktop's widths (520 is its smallest window, `electron/windowBounds.ts`).
 * The phones (360–430) are the owner web's own shell (top bar, no side menu),
 * not this bundle's; they are measured against that app.
 */
const WIDTHS = [520, 640, 768, 900, 1024, 1100, 1280, 1440, 1920, 2560];

/** A company two weeks late with access limited: the longest sentence the card says. */
const overdue = () => {
  const base = platformBillingOverview(1);
  return {
    ...base,
    outstanding_amount: "1212500.50",
    next_due_on: "2026-11-01",
    billing_state: "overdue",
    billing_access: "restricted",
    days_overdue: 14,
    current_period: { ...base.current_period, gross_amount: "8450000.00", commission_amount: "422500.00" },
    open_invoice: {
      id: 9, company_id: 1, company_name: "Club", period_start: "2026-10-01", period_end: "2026-10-31", currency: "AMD",
      commission_percent: "5.00", gross_amount: "24250010.00", amount: "1212500.50", paid_amount: "0.00",
      adjustments_amount: "0.00", balance: "1212500.50", issued_at: "2026-11-01T00:00:00+04:00", due_on: "2026-11-01",
      effective_due_on: "2026-11-01", paid_at: null, status: "open", billing_state: "overdue", days_overdue: 14,
      billing_access: "restricted",
    },
  };
};

const open = async (page: Page, lang: Lang, width: number, body: object) => {
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && /^\/company\/\d+\/platform-billing$/.test(u.pathname), (r) => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(body),
  }));
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o.com");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: SIGN_IN[lang], exact: true }).click();
  await expect(page.getByTestId("platform-debt-card")).toBeVisible();
  await page.waitForTimeout(250); // fonts and the entrance
};

interface Box { left: number; top: number; right: number; bottom: number }
const facts = (page: Page) => page.evaluate(() => {
  const card = document.querySelector<HTMLElement>("[data-testid=platform-debt-card]")!;
  const more = card.querySelector<HTMLElement>(".platform-debt__more")!;
  const rect = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const texts: { text: string; box: ReturnType<typeof rect> }[] = [];
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim() || more.contains(n)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) texts.push({ text: n.textContent.trim(), box: rect(r) });
  }
  // Boxes drawn inside the card (the access badge, the icon) count as content too.
  for (const el of Array.from(card.querySelectorAll<HTMLElement>("svg, .billing-badge, [class*=badge]"))) {
    if (more.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) texts.push({ text: `<${el.className.toString() || el.tagName}>`, box: rect(r) });
  }
  return {
    card: rect(card.getBoundingClientRect()),
    more: rect(more.getBoundingClientRect()),
    texts,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
const meet = (a: Box, b: Box) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const inside = (a: Box, outer: Box) => a.left >= outer.left - 0.5 && a.right <= outer.right + 0.5 && a.top >= outer.top - 0.5 && a.bottom <= outer.bottom + 0.5;

/** A chain's month: an eight-digit debt, the widest amount line. */
const large = () => {
  const o = overdue();
  return { ...o, outstanding_amount: "12125000.50", open_invoice: { ...o.open_invoice, amount: "12125000.50", balance: "12125000.50" } };
};

for (const [caseName, body] of [["overdue", overdue()], ["nothing owed", platformBillingOverview(1)], ["large debt", large()]] as const) {
  for (const lang of LANGS) {
    for (const width of WIDTHS) {
      test(`debt card (${caseName}), ${lang}, ${width}px: «Details» lies on no text, nothing leaves the card`, async ({ page }) => {
        await open(page, lang, width, body);
        const f = await facts(page);
        if (SHOTS) {
          await page.getByTestId("platform-debt-card").screenshot({ path: path.join(SHOTS, `debt-${caseName.replace(/ /g, "-")}-${lang}-${width}.png`) });
        }
        const under = f.texts.filter((t) => meet(t.box, f.more)).map((t) => t.text);
        expect(under, "text under the button").toEqual([]);
        expect(inside(f.more, f.card), "button inside the card").toBe(true);
        const out = f.texts.filter((t) => !inside(t.box, f.card)).map((t) => t.text);
        expect(out, "text outside the card").toEqual([]);
        expect(f.pageOverflow).toBeLessThanOrEqual(0);
      });
    }
  }
}
