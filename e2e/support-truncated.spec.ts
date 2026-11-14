import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * A support message too big for one Reverb frame (backend, 2026-11-14): the
 * `support.message.created` event carries `body: null` + `body_truncated: true`.
 * On the real bundle with a mocked Reverb socket (Pusher protocol): such an
 * event makes the open thread read itself again and the full text appears; it
 * never becomes an empty bubble. A normal event is still rendered straight
 * from the payload, with no extra request.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.SUPPORT_SHOTS;
const CHANNEL = "private-support.user.1";

const conversation = {
  id: 7, reference: "SUP-7", status: "open", branch_id: 1, company_id: 1,
  branch_address: "Abovyan 5", branch_city: "Yerevan", company_name: "Neon Arena",
  logo_path: null, unread: 0, last_message_at: "2026-11-14T10:00:00Z",
};
const message = (id: number, sender: "staff" | "support", body: string | null, extra: Record<string, unknown> = {}) => ({
  id, conversation_id: 7, sender, sender_name: sender === "staff" ? "Owner One" : "Support",
  sender_role: null, body, delivery: "sent", delivery_error: null, read_at: null,
  created_at: "2026-11-14T10:00:00Z", attachments: [], ...extra,
});
const LONG = `${"Длинный ответ поддержки. ".repeat(60)}КОНЕЦ`;

/** A Reverb that speaks just enough Pusher to hold one private channel. */
const mockReverb = async (page: Page) => {
  const state: { socket: WebSocketRoute | null; subscribed: Set<string> } = { socket: null, subscribed: new Set() };
  await page.routeWebSocket((url) => url.pathname.startsWith("/app/"), (ws) => {
    state.socket = ws;
    ws.send(JSON.stringify({ event: "pusher:connection_established", data: JSON.stringify({ socket_id: "123.456", activity_timeout: 120 }) }));
    ws.onMessage((raw) => {
      const frame = JSON.parse(String(raw)) as { event: string; data?: { channel?: string } };
      if (frame.event === "pusher:ping") ws.send(JSON.stringify({ event: "pusher:pong", data: "{}" }));
      if (frame.event === "pusher:subscribe" && frame.data?.channel) {
        state.subscribed.add(frame.data.channel);
        ws.send(JSON.stringify({ event: "pusher_internal:subscription_succeeded", channel: frame.data.channel, data: "{}" }));
      }
    });
  });
  const emit = (payload: unknown) => state.socket!.send(JSON.stringify({
    event: "support.message.created", channel: CHANNEL, data: JSON.stringify(payload),
  }));
  return { state, emit };
};

test("a truncated support event re-reads the thread; a normal one renders from the payload", async ({ page }) => {
  const reverb = await mockReverb(page);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/broadcasting/auth", (r) => r.fulfill(json({ auth: "key:signature" })));
  await page.route((u) => isBackend(u) && u.pathname === "/support/conversations", (r) =>
    r.request().method() === "GET" ? r.fulfill(json({ data: [conversation] })) : r.fallback());
  let threadReads = 0;
  let serverMessages = [message(1, "support", "Hello, how can we help?")];
  await page.route((u) => isBackend(u) && u.pathname === "/support/conversations/7", (r) => {
    threadReads += 1;
    return r.fulfill(json({ conversation, messages: serverMessages }));
  });
  await page.route((u) => isBackend(u) && u.pathname === "/support/conversations/7/read", (r) => r.fulfill(json({ ok: true })));

  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.goto("/#/support");
  await expect(page.locator(".support-messages").getByText("Hello, how can we help?")).toBeVisible();
  await expect.poll(() => reverb.state.subscribed.has(CHANNEL)).toBe(true);
  const readsAfterOpen = threadReads;

  // A normal event: rendered from the payload, no extra read.
  reverb.emit({ conversation_id: 7, reference: "SUP-7", message: message(2, "support", "Short reply") });
  await expect(page.locator(".support-messages").getByText("Short reply")).toBeVisible();
  expect(threadReads).toBe(readsAfterOpen);

  // A truncated one: no empty bubble; the thread is read and the text shown.
  serverMessages = [...serverMessages, message(2, "support", "Short reply"), message(3, "support", LONG)];
  reverb.emit({ conversation_id: 7, reference: "SUP-7", message: message(3, "support", null, { body_truncated: true }) });
  await expect(page.locator(".support-messages").getByText(/КОНЕЦ/)).toBeVisible();
  expect(threadReads).toBe(readsAfterOpen + 1);
  const bubbles = await page.locator(".support-bubble").evaluateAll((els) => els.map((e) => ({
    text: (e.textContent ?? "").replace(/Support|Owner One|·|\d{2}[.:]\d{2}[.:\d\s]*/g, "").trim(),
  })));
  expect(bubbles.filter((b) => b.text === "")).toEqual([]);
  expect(bubbles).toHaveLength(3);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/support-truncated-event.png` });
});
