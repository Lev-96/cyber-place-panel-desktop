import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, signIn } from "./helpers/moneySession";

/**
 * After a seat ends by itself (2026-11-20, owner): «Эти товары оплатили?»
 * FIRST, at once, naming only what was put on the seat while it played; the
 * final bill opens only after «Да»/«Нет» and the way of paying. A seat with
 * nothing to confirm shows the bill at once, with no question.
 *
 * The seat's end arrives the way it does in the club: a `session.changed`
 * frame on the branch's private channel (a fake Reverb, as in
 * support-truncated.spec.ts).
 */
const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/due-before-receipt-2026-11-20");
const CHANNEL = "private-branch.1";

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
  const ended = () => state.socket!.send(JSON.stringify({
    event: "session.changed", channel: CHANNEL, data: JSON.stringify({
      kind: "stopped", session_id: 5, branch_id: 1, pc_id: 3, place_id: 13, status: "expired", mode: "fixed",
      is_free: false, is_unlimited: false, joystick_count: 1, ends_at: null, at: new Date().toISOString(),
    }),
  }));
  return { state, ended };
};

/** Paid ahead 1 500 by card (an hour + Cola ×1 at the Start); Cola ×2 and Chips added while it played. */
const seat = () => runningSession({
  mode: "fixed", is_unlimited: false, committed_amount: 1000, prepaid_amount: "1500.00",
  // Still a few minutes to go on the board's copy, so its own end-of-time
  // re-read never drops the seat before the frame lands.
  started_at: new Date(Date.now() - 55 * 60_000).toISOString(), ends_at: new Date(Date.now() + 5 * 60_000).toISOString(),
});
const due = {
  session_id: 5, branch_id: 1, place: { id: 13, number: 3, name: "Hall 3" }, ended_at: new Date().toISOString(),
  total: "2800.00", prepaid: "1500.00", due: "1300.00", prepaid_by_method: { card: "1500.00" },
  items: [{ name: "Coca-Cola", qty: 2, price: "500.00" }, { name: "Chips", qty: 1, price: "300.00" }],
};
const bill = {
  mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 60, time_cost: 1000, hourly_rate: 1000, package_name: null,
  items: [{ id: 1, name: "Coca-Cola", qty: 3, price: 500, line_total: 1500 }, { id: 2, name: "Chips", qty: 1, price: 300, line_total: 300 }],
  items_total: 1800, unpaid_items_total: 0, joysticks: [], joysticks_total: 0, subtotal: 2800, gross_total: 2800, total: 2800,
  priced_at: new Date().toISOString(), prepaid: null, payment_recorded: true,
};

const setUp = async (page: Page, lang: (typeof LANGS)[number], width: number, owes: boolean) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const reverb = await mockReverb(page);
  let list: unknown[] = [];
  let ended = false;
  const sent: unknown[] = [];
  await signIn(page, lang, width, "manager", async () => {
    await page.route(at("/broadcasting/auth"), (r) => r.fulfill(json({ auth: "key:signature" })));
    await page.route(at("/sessions/dues-to-confirm"), (r) => r.fulfill(json({ data: list })));
    await page.route(at("/sessions/5/confirm-due"), (r) => {
      sent.push(r.request().postDataJSON());
      list = [];
      return r.fulfill(json({ session: { id: 5 }, cash: null }));
    });
    await page.route(at("/sessions/5/preview"), (r) => r.fulfill(json({ preview: bill })));
  });
  await seedBoard(page, { sessions: () => (ended ? [] : [seat()]) });
  await openBoard(page);
  // The seat must be ON the board (its session read) before it ends: a tile
  // drawn from the device list alone has no session to open a bill for.
  await expect(page.locator(".session-timer__cost").first()).toBeVisible();
  await expect.poll(() => reverb.state.subscribed.has(CHANNEL)).toBe(true);
  const end = () => {
    if (owes) list = [due];
    reverb.ended();
    // After the frame: a read the frame triggers finds the seat gone.
    ended = true;
  };
  return { end, sent };
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    for (const answer of ["yes", "no"] as const) {
      test(`ended owing for products: «оплатили?» first, «${answer}», then the bill (${lang}, ${width})`, async ({ page }) => {
        const { end, sent } = await setUp(page, lang, width, true);
        end();
        const ask = page.getByTestId("due-confirm");
        // At once — not on the 30-second poll.
        await expect(ask).toBeVisible({ timeout: 3000 });
        await expect(page.getByTestId("due-confirm-items")).toContainText("Coca-Cola × 2");
        await expect(page.getByTestId("due-confirm-items")).toContainText("Chips × 1");
        await expect(page.getByTestId("checkout-ended-elsewhere")).toHaveCount(0);
        await noRawKeys(page, "[data-testid=due-confirm]");
        await fitsWidth(page, "[data-testid=due-confirm]");
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/1-ask-${answer}-${lang}-${width}.png` });

        await page.getByTestId(answer === "yes" ? "due-confirm-yes" : "due-confirm-no").click();
        await expect(page.getByTestId("payment-editor")).toBeVisible();
        // Still no bill while the way of paying is being chosen.
        await expect(page.getByTestId("checkout-ended-elsewhere")).toHaveCount(0);
        await page.getByTestId("due-confirm-save").click();
        await expect.poll(() => sent).toEqual([{ payment_method: answer === "yes" ? "card" : "cash" }]);

        await expect(ask).toHaveCount(0);
        await expect(page.getByTestId("checkout-ended-elsewhere")).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/2-bill-${answer}-${lang}-${width}.png` });
      });
    }

    test(`ended with nothing to confirm: the bill at once, no question (${lang}, ${width})`, async ({ page }) => {
      const { end } = await setUp(page, lang, width, false);
      end();
      await expect(page.getByTestId("checkout-ended-elsewhere")).toBeVisible({ timeout: 3000 });
      await expect(page.getByTestId("due-confirm")).toHaveCount(0);
    });
  }
}
