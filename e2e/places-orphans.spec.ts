import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * Devices without a place, on the real bundle and CSS (2026-11-04, owner:
 * "Active Places shows 10, Places shows 7"): named under the places, with a
 * delete button that a running session disables, laid out inside the page at
 * a wide and the narrowest window.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

const seed = async (page: Page) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [
    { id: 1, branch_id: 1, place_id: 11, label: "№1", kind: "ps", status: "online", place: { id: 11, number: 1, platform: "ps5" } },
    { id: 108, branch_id: 1, place_id: null, label: "№5", kind: "ps", status: "online", place: null },
    { id: 121, branch_id: 1, place_id: null, label: "№11", kind: "ps", status: "in_session", place: null },
  ] })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: [
    { id: 658, branch_id: 1, pc_id: 121, status: "active", started_at: new Date().toISOString(), ends_at: null, is_unlimited: true },
  ] })));
};

for (const width of [1440, 520]) {
  test(`Places at ${width}px: the devices without a place are named, a running one cannot be deleted`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    await page.goto("/");
    await page.getByPlaceholder("your@email.com").fill("o@o");
    await page.getByPlaceholder(/•/).fill("ok");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Owner One").first()).toBeVisible();
    await page.goto("/#/branches/1/places");
    const notice = page.getByTestId("devices-without-place");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Devices without a place: 2");
    await expect(page.getByTestId("orphan-device-remove-108")).toBeEnabled();
    await expect(page.getByTestId("orphan-device-remove-121")).toBeDisabled();
    await expect(page.getByTestId("orphan-device-121")).toContainText("session running");
    const layout = await page.evaluate(() => {
      const main = document.querySelector("main.main") as HTMLElement;
      const box = (document.querySelector('[data-testid="devices-without-place"]') as HTMLElement).getBoundingClientRect();
      const m = main.getBoundingClientRect();
      return {
        pageScrolls: document.documentElement.scrollWidth > window.innerWidth + 1 || main.scrollWidth > main.clientWidth + 1,
        inside: box.left >= m.left - 1 && box.right <= m.left + main.clientWidth + 1,
      };
    });
    expect(layout).toEqual({ pageScrolls: false, inside: true });
  });
}
