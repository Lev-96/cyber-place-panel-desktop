import { expect, test } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Role gating regression: manager must NOT see "Менеджеры" or "Тарифы"
 * tiles on the branch hub. This is the contract added when manager role
 * was first allowed into the hub. If someone deletes the `can()` checks
 * by mistake, this test fires.
 *
 * Owner must be allowed into /companies/:id/revenue (the bug previously
 * redirected owner to "/" because the route was gated by `menu.companies`).
 */

const BACKEND = "https://cyber-place-server-staging-production.up.railway.app";

test("manager hub hides Managers and Tariffs tiles", async ({ page }) => {
  await installBackendMocks(page, {
    role: "manager",
    branch_id: 1,
    name: "Manager One",
  });
  await page.route(`${BACKEND}/branches/1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        branch: {
          id: 1,
          address: "Test st. 1",
          country: "AM",
          city: "Yerevan",
          branch_logo_path: null,
          company: { id: 1, name: "TestCo" },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("m@m");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Skip the click — go directly to /branches/1 via hash route.
  await page.goto("/#/branches/1");

  // Wait for the hub grid to render at least one tile — confirms the
  // page is past the loading spinner.
  await expect(page.locator("a.card").first()).toBeVisible({ timeout: 15_000 });

  // Tiles that MUST NOT be present for manager. This is the actual
  // permission contract (positive tile presence is covered by
  // unit-level auth/permissions.test.ts).
  await expect(page.locator("a.card", { hasText: "Managers" })).toHaveCount(0);
  await expect(page.locator("a.card", { hasText: /^Tariffs/ })).toHaveCount(0);
});

test("owner can navigate to revenue page (regression: was redirected to /)", async ({ page }) => {
  await installBackendMocks(page, {
    role: "company_owner",
    company_id: 1,
    name: "Owner One",
  });
  await page.route(`${BACKEND}/companies/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: { total: 0 },
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Direct nav to /revenue — owner must NOT be redirected away.
  await page.goto("/#/revenue");
  await expect(page.getByRole("heading", { name: /Revenue & commission/i })).toBeVisible();
});
