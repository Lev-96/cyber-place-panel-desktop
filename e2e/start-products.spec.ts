import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";
import { dismissUnpaidNotice } from "./helpers/unpaidNotice";

/**
 * Start, 2026-11-20 (owner): «+ Товар» puts products on the seat from the
 * start, and «Сейчас, до игры» with a sum and no length BUYS time (the seat
 * ends by itself) — sent as «На сумму». Real bundle and CSS, ru/en/am ×
 * desktop/phone; screenshots into the task's report folder.
 */
const SHOTS = "/home/developer/cyber-place-local/reports/start-products-2026-11-20";
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
type Lang = "en" | "ru" | "am";
const PICKER: Record<Lang, string> = { en: "Choose from the list", ru: "Выбрать из списка", am: "Ընտրել ցանկից" };
const seat = (n: number) => ({
  id: n, branch_id: 1, place_id: 100 + n, label: `PC ${n}`, kind: "pc", status: "online", is_startable: true,
  hourly_rate: 1000, assigned_hourly_rate: 1000, current_session_id: null,
  place: { id: 100 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "pc" },
});

const signIn = async (page: Page, lang: Lang, width: number, starts: Record<string, unknown>[], quotes: string[]) => {
  await page.setViewportSize({ width, height: 900 });
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "manager", company_id: 1, branch_id: 1, name: "Karen" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2].map(seat) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => {
    if (r.request().method() === "POST") {
      starts.push(r.request().postDataJSON());
      return r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ session: { id: 9, branch_id: 1, pc_id: 1, mode: "fixed", status: "active", started_at: new Date().toISOString(), ends_at: null, hourly_rate: 1000, total_paid: 0, is_free: false, items: [] } }) });
    }
    return r.fulfill(json({ data: [] }));
  });
  await page.route((u) => isBackend(u) && u.pathname === "/time-packages", (r) => r.fulfill(json({ data: [] })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/start-options", (r) => r.fulfill(json({
    free_until: null, max_minutes: null, unlimited_allowed: true, next_booking: null, claimable_bookings: [], outside_food_fee: null,
  })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/start-quote", (r) => {
    const q = new URL(r.request().url()).searchParams;
    quotes.push(q.toString());
    const amount = Number(q.get("amount"));
    const products = q.get("items[0][product_id]") ? 500 * Number(q.get("items[0][qty]")) : 0;
    const time = amount - products;
    const seconds = time * 3.6;
    return r.fulfill(json({ amount, hourly_rate: 1000, outside_food_fee: products, time_amount: time, seconds, minutes: Math.floor(seconds / 60), ends_at: new Date(Date.now() + seconds * 1000).toISOString(), standard_amount: null }));
  });
  await page.route((u) => isBackend(u) && u.pathname === "/products", (r) => r.fulfill(json({ data: [
    { id: 21, branch_id: 1, name: "Cola", price: "500.00", is_active: true, kind: "regular" },
    { id: 22, branch_id: 1, name: "Pad", price: "200.00", is_active: true, kind: "additional" },
  ] })));
  await page.route((u) => isBackend(u) && /^\/company\/\d+\/platform-billing$/.test(u.pathname), (r) => r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not found" }) }));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("k@k");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: { en: "Sign in", ru: "Вход", am: "Մուտք" }[lang], exact: true }).click();
  await expect(page.getByText("Karen").first()).toBeVisible();
};

for (const lang of ["ru", "en", "am"] as const) {
  for (const width of [1280, 390]) {
    test(`${lang} ${width}px: 2 Colas with the start, paid now 3 000 → the time it buys, sent as «На сумму» with the items`, async ({ page }) => {
      const starts: Record<string, unknown>[] = [];
      const quotes: string[] = [];
      await signIn(page, lang, width, starts, quotes);
      await page.goto("/#/branches/1/sessions");
      await page.locator('.place-cell [data-action="start"]').first().click();
      await dismissUnpaidNotice(page);
      await expect(page.locator(".start-dialog")).toBeVisible();

      await page.getByTestId("start-products-add").click();
      await page.getByTestId("start-products-dialog").getByText(PICKER[lang], { exact: true }).click();
      const dlg = page.getByTestId("start-products-dialog");
      await expect(dlg.getByText("Pad")).toHaveCount(0);
      const add = dlg.getByRole("button", { name: /Cola/ }).first();
      await add.click();
      await add.click();
      await page.getByTestId("start-products-confirm").click();
      await expect(page.getByTestId("start-product-21")).toContainText("Cola × 2");

      await page.getByTestId("prepaid-switch").click();
      await page.getByTestId("start-prepaid-sum").locator("input").fill("3000");
      await expect(page.getByTestId("start-prepaid-buys")).toContainText(/2/);
      await expect(page.getByTestId("start-products-total")).toBeVisible();
      expect(await page.locator("[role=dialog], .start-dialog").first().innerText()).not.toMatch(/session\.[a-zA-Z.]+/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.waitForTimeout(300);
      await page.locator(".start-dialog").screenshot({ path: `${SHOTS}/start-${lang}-${width}.png` });

      await page.getByRole("button", { name: { en: "Start", ru: "Старт", am: "Սկսել" }[lang], exact: true }).last().click();
      await expect.poll(() => starts.length).toBe(1);
      expect(starts[0]).toMatchObject({ mode: "open", paid_amount: 3000, paid_seconds: 7200, items: [{ product_id: 21, qty: 2 }] });
      expect(starts[0]).not.toHaveProperty("prepaid_sum");
      expect(quotes.some((q) => q.includes("items%5B0%5D%5Bproduct_id%5D=21") || q.includes("items[0][product_id]=21"))).toBe(true);
    });
  }
}
