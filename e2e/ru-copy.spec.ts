import { expect, test } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * B9 (audit 2026-11-13): the Russian board header said «+ Продукт» while the
 * session card says «+ Товар», and «История торговли». On the real bundle:
 * one word, and «История продаж». `RU_COPY_SHOTS=<dir>` also writes a screenshot.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test("ru: the board header says «+ Товар» and «История продаж»", async ({ page }) => {
  await seedLanguageChosen(page, "ru");
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [{
    id: 1, branch_id: 1, place_id: 101, label: "PC 1", kind: "pc", status: "online", is_startable: true,
    hourly_rate: 1200, assigned_hourly_rate: 1200, current_session_id: null,
    place: { id: 101, number: 1, name: "Hall 1", type: "standard", platform: "pc" },
  }] })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => r.fulfill(json({
    branch: { id: 1, name: "Hall", company_id: 1, price_for_branch: { id: 1, branch_id: 1, "pc-standard": 1000, "pc-vip": 1200 } },
  })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/branches/1/sessions");
  const main = page.locator("main.main");
  await expect(main.getByRole("button", { name: "+ Товар", exact: true }).first()).toBeVisible();
  await expect(main.getByText("История продаж").first()).toBeVisible();
  await expect(main.getByText("+ Продукт")).toHaveCount(0);
  await expect(main.getByText("История торговли")).toHaveCount(0);
  if (process.env.RU_COPY_SHOTS) await page.screenshot({ path: `${process.env.RU_COPY_SHOTS}/ru-copy-board.png` });
});
