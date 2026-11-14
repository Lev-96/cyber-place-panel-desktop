import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * The support chat's composer (owner, 2026-11-14: "the input is small and does
 * not follow the window"). On the real bundle and CSS, at the minimum window
 * and two desk sizes: the field spans the thread, nothing runs past it, many
 * lines grow the field to a cap and then it scrolls inside itself, and Enter
 * still sends. `SUPPORT_SHOTS=<dir>` also writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.SUPPORT_SHOTS;

const conversation = {
  id: 7, reference: "SUP-7", status: "open", branch_id: 1, company_id: 1,
  branch_address: "Abovyan 5", branch_city: "Yerevan", company_name: "Neon Arena",
  logo_path: null, unread: 0, last_message_at: "2026-11-14T10:00:00Z",
};
const message = (id: number, sender: "staff" | "support", body: string) => ({
  id, conversation_id: 7, sender, sender_name: sender === "staff" ? "Owner One" : "Support",
  sender_role: null, body, delivery: "sent", delivery_error: null, read_at: null,
  created_at: "2026-11-14T10:00:00Z", attachments: [],
});

const openSupport = async (page: Page, width: number, height: number) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/support/conversations", (r) =>
    r.request().method() === "GET" ? r.fulfill(json({ data: [conversation] })) : r.fallback());
  await page.route((u) => isBackend(u) && u.pathname === "/support/conversations/7", (r) => r.fulfill(json({
    conversation, messages: [message(1, "support", "Hello, how can we help?"), message(2, "staff", "The PS5 in hall 2 will not wake.")],
  })));
  await page.route((u) => isBackend(u) && u.pathname === "/support/conversations/7/read", (r) => r.fulfill(json({ ok: true })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.setViewportSize({ width, height });
  await page.goto("/#/support");
  await expect(page.getByText("The PS5 in hall 2 will not wake.")).toBeVisible();
};

const measure = (page: Page) => page.evaluate(() => {
  const thread = document.querySelector(".support-thread") as HTMLElement;
  const field = document.querySelector(".support-composer__field") as HTMLTextAreaElement;
  const composer = document.querySelector(".support-composer") as HTMLElement;
  const t = thread.getBoundingClientRect();
  const cs = getComputedStyle(thread);
  const inner = t.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  const f = field.getBoundingClientRect();
  const pastEdge = Array.from(composer.querySelectorAll<HTMLElement>("*")).filter((el) => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && (b.right > t.right + 1 || b.left < t.left - 1);
  }).map((el) => el.className || el.tagName);
  const main = document.querySelector("main.main") as HTMLElement | null;
  return {
    ratio: f.width / inner,
    height: f.height,
    clientHeight: field.clientHeight,
    scrollHeight: field.scrollHeight,
    pastEdge,
    composerOverflow: composer.scrollWidth - composer.clientWidth,
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
  };
});

for (const [width, height] of [[520, 560], [960, 600], [1280, 720]] as const) {
  test(`${width}×${height}: the composer spans the thread, grows, then scrolls`, async ({ page }) => {
    await openSupport(page, width, height);
    const field = page.locator(".support-composer__field");
    await expect(field).toBeVisible();

    const before = await measure(page);
    expect(before.ratio).toBeGreaterThanOrEqual(0.9);
    expect(before.pastEdge).toEqual([]);
    expect(before.composerOverflow).toBeLessThanOrEqual(1);
    expect(before.pageOverflow).toBeLessThanOrEqual(1);
    expect(before.mainOverflow).toBeLessThanOrEqual(1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/support-composer-${width}x${height}-empty.png` });

    // A few lines: the field grows to show them, no inner scroll yet.
    await field.click();
    await field.pressSequentially("line 1");
    for (let i = 2; i <= 3; i += 1) {
      await page.keyboard.press("Shift+Enter");
      await page.keyboard.type(`line ${i}`);
    }
    const few = await measure(page);
    expect(few.height).toBeGreaterThan(before.height);
    expect(few.scrollHeight).toBeLessThanOrEqual(few.clientHeight + 1);

    // Many lines: it stops at its cap and scrolls inside itself.
    for (let i = 4; i <= 30; i += 1) {
      await page.keyboard.press("Shift+Enter");
      await page.keyboard.type(`line ${i}`);
    }
    const many = await measure(page);
    expect(many.height).toBeGreaterThan(few.height);
    expect(many.scrollHeight).toBeGreaterThan(many.clientHeight + 10);
    expect(many.height).toBeLessThanOrEqual(Math.min(0.3 * height, 220) + 1);
    expect(many.ratio).toBeGreaterThanOrEqual(0.9);
    expect(many.pastEdge).toEqual([]);
    expect(many.pageOverflow).toBeLessThanOrEqual(1);
    // Shift+Enter made new lines, it did not send.
    expect(await field.inputValue()).toContain("line 30");
    // The send button is wholly on screen with the field at its cap: the page
    // follows the growing field, even at the minimum window.
    await expect(page.locator(".support-composer__send")).toBeInViewport({ ratio: 1 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/support-composer-${width}x${height}-many-lines.png` });
  });
}

test("Enter sends the message and the field shrinks back", async ({ page }) => {
  await openSupport(page, 960, 600);
  let sent = "";
  await page.route((u) => isBackend(u) && u.pathname === "/support/conversations/7/messages", async (r) => {
    sent = r.request().postData() ?? "";
    await r.fulfill(json({ message: message(3, "staff", "first\nsecond") }));
  });
  const field = page.locator(".support-composer__field");
  const empty = (await field.boundingBox())!.height;
  await field.click();
  await page.keyboard.type("first");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("third");
  expect((await field.boundingBox())!.height).toBeGreaterThan(empty);
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("");
  expect(sent).toMatch(/first\r?\nsecond\r?\nthird/);
  await expect.poll(async () => (await field.boundingBox())!.height).toBeLessThanOrEqual(empty + 1);
});
