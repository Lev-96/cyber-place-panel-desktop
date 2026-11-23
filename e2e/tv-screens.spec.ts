import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * «Сообщения игрокам» on the Places screen (2026-11-23, owner: only PSN, one
 * way for every TV): the owner names the PSN account each PlayStation place's
 * console is signed in with; no TV pairing is offered. A manager has no
 * button (owner-level, like the consoles). Real bundle and CSS, wide and narrow.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const signIn = async (page: Page, role: string, name: string) => {
  await installBackendMocks(page, { role, company_id: 1, name });
  await page.route((u) => isBackend(u) && u.pathname === "/places", (r) => r.fulfill(json({ data: [
    { id: 7, branch_id: 1, number: 7, name: null, platform: "ps5", type: "standard", status: "active" },
    { id: 9, branch_id: 1, number: 9, name: "Pool", platform: "billiards", type: "standard", status: "active" },
  ], meta: { total: 2 } })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
};

for (const width of [1440, 520]) {
  test(`Player messages at ${width}px: the owner names the console's PSN account, no TV pairing`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const put: unknown[] = [];
    let tvListAsked = false;
    await signIn(page, "company_owner", "Owner One");
    await page.route((u) => isBackend(u) && u.pathname === "/branches/1/psn-places", (r) => r.fulfill(json({ enabled: true, data: [] })));
    await page.route((u) => isBackend(u) && u.pathname === "/companies/1/psn-sender", (r) => r.fulfill(json({ data: {
      connected: true, online_id: "CyberArena_Club", expires_at: null, last_error: null, last_error_at: null, last_sent_at: null,
    } })));
    await page.route((u) => isBackend(u) && u.pathname === "/places/7/psn-account", async (r) => {
      put.push({ method: r.request().method(), body: r.request().postDataJSON() });
      return r.fulfill(json({ data: { place_id: 7, online_id: "ClubPS7" } }));
    });
    await page.route((u) => isBackend(u) && u.pathname === "/branches/1/tv-screens", (r) => { tvListAsked = true; return r.fulfill(json({ data: [] })); });

    await page.goto("/#/branches/1/places");
    await page.getByTestId("tv-open").click();
    await expect(page.getByRole("heading", { name: "Player messages", exact: true })).toBeVisible();
    await expect(page.getByTestId("tv-pair-form")).toHaveCount(0);

    const rows = page.getByTestId("tv-psn-row");
    await expect(rows).toHaveCount(1);
    await rows.first().locator("input").fill("ClubPS7");
    await rows.first().getByRole("button", { name: "Save" }).click();
    await expect.poll(() => put.length).toBe(1);
    expect(put).toEqual([{ method: "PUT", body: { online_id: "ClubPS7" } }]);
    expect(tvListAsked).toBe(false);

    const layout = await page.evaluate(() => {
      const card = document.querySelector(".tv-dialog") as HTMLElement;
      const r = card.getBoundingClientRect();
      return { inside: r.left >= 0 && r.right <= window.innerWidth + 1, scrolls: card.scrollWidth > card.clientWidth + 1 };
    });
    expect(layout).toEqual({ inside: true, scrolls: false });
  });
}

test("Player messages: a manager has no button", async ({ page }) => {
  await signIn(page, "manager", "Manager One");
  await page.goto("/#/branches/1/places");
  await page.waitForTimeout(500);
  await expect(page.getByTestId("tv-open")).toHaveCount(0);
});
