import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * A club's TVs on the Places screen (2026-11-23): the owner pairs a TV by the
 * code on its screen; a manager has no such button (owner-level, like the
 * consoles). On the real bundle and CSS, at a wide and a narrow window.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const signIn = async (page: Page, role: string, name: string) => {
  await installBackendMocks(page, { role, company_id: 1, name });
  await page.route((u) => isBackend(u) && u.pathname === "/places", (r) => r.fulfill(json({ data: [
    { id: 7, branch_id: 1, number: 7, name: null, platform: "ps5", type: "standard", status: "active" },
    { id: 8, branch_id: 1, number: 8, name: "Corner", platform: "ps5", type: "standard", status: "active" },
  ], meta: { total: 2 } })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
};

for (const width of [1440, 520]) {
  test(`TVs at ${width}px: the owner pairs a TV to a place by its code`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const screens: unknown[] = [];
    const posted: unknown[] = [];
    await signIn(page, "company_owner", "Owner One");
    await page.route((u) => isBackend(u) && u.pathname === "/branches/1/tv-screens", async (r) => {
      if (r.request().method() === "POST") {
        const body = r.request().postDataJSON();
        posted.push(body);
        const made = { id: 3, branch_id: 1, place_id: body.place_id, place_name: null, place_number: 8, name: body.name, paired_at: "2026-11-23T01:00:00+04:00", last_seen_at: null, online: false };
        screens.push(made);
        return r.fulfill(json({ data: made }, 201));
      }
      return r.fulfill(json({ data: screens }));
    });

    await page.goto("/#/branches/1/places");
    await page.getByTestId("tv-open").click();
    await expect(page.getByText("No TVs yet.")).toBeVisible();

    await page.getByTestId("tv-code").fill("123 456");
    await page.getByTestId("tv-place").selectOption("8");
    await page.getByTestId("tv-pair").click();

    await expect(page.getByTestId("tv-row")).toHaveCount(1);
    expect(posted).toEqual([{ code: "123456", place_id: 8, name: null }]);

    const layout = await page.evaluate(() => {
      const card = document.querySelector(".tv-dialog") as HTMLElement;
      const r = card.getBoundingClientRect();
      return { inside: r.left >= 0 && r.right <= window.innerWidth + 1, scrolls: card.scrollWidth > card.clientWidth + 1 };
    });
    expect(layout).toEqual({ inside: true, scrolls: false });
  });
}

test("TVs: a manager has no TV button", async ({ page }) => {
  await signIn(page, "manager", "Manager One");
  await page.goto("/#/branches/1/places");
  await page.waitForTimeout(500);
  await expect(page.getByTestId("tv-open")).toHaveCount(0);
});
