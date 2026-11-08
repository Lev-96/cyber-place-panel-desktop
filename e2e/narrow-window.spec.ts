import { expect, test } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Every screen at the narrowest window the desktop allows (520px, owner,
 * 2026-11-04: "the window shrinks without limits"), with the side menu folded
 * and open: the page itself never scrolls sideways. Content that is wider by
 * nature (a table, the interface preview, a list at its readable floor)
 * scrolls inside its own box, which is allowed; nothing pushes past the page.
 */
const ROUTES = [
  "/", "/appearance", "/bookings", "/branches", "/branches/1", "/branches/1/sessions", "/branches/1/sessions/history",
  "/branches/1/places", "/branches/1/pcs", "/branches/1/tariffs", "/branches/1/products", "/branches/1/members",
  "/branches/1/shift", "/branches/1/subscribers", "/branches/1/tournaments", "/branches/1/pos", "/branches/1/edit",
  "/my-company", "/revenue", "/shifts", "/notifications", "/settings", "/support", "/tournaments", "/expenses", "/managers",
];

for (const folded of [true, false]) {
  test(`520px, side menu ${folded ? "folded" : "open"}: no screen scrolls sideways`, async ({ page }) => {
    test.setTimeout(180_000);
    await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto("/");
    await page.getByPlaceholder("your@email.com").fill("o@o");
    await page.getByPlaceholder(/•/).fill("ok");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Owner One").first()).toBeVisible();
    const toggle = page.getByTestId("sidebar-toggle");
    if ((await toggle.getAttribute("aria-expanded") === "false") !== folded) await toggle.click();
    await page.setViewportSize({ width: 520, height: 900 });
    const offenders: string[] = [];
    for (const route of ROUTES) {
      await page.goto(`/#${route}`);
      await page.waitForTimeout(500);
      const f = await page.evaluate(() => {
        const main = document.querySelector("main.main") as HTMLElement | null;
        return {
          doc: document.documentElement.scrollWidth - window.innerWidth,
          main: main ? main.scrollWidth - main.clientWidth : 0,
        };
      });
      if (f.doc > 1 || f.main > 1) offenders.push(`${route}: page ${f.doc}px, main ${f.main}px`);
    }
    expect(offenders).toEqual([]);
  });
}
