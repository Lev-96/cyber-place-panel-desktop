import { describe, expect, test } from "vitest";
import { DELIVERY_STUCK_AFTER_MS, arrivalNeedsRefetch, isStuckInDelivery, mergeMessage, reconcileThread } from "./SupportChat";
import type { ISupportMessage } from "@/api/support";

/**
 * The thread folds an arriving message in by id, and the two cases it has to
 * get right pull in opposite directions: a replay must not duplicate a line,
 * and a re-announcement of the same message MUST update it — that is how the
 * "delivering to support…" label learns that the worker handed it to Telegram.
 */

const msg = (id: number, over: Partial<ISupportMessage> = {}): ISupportMessage => ({
  id,
  conversation_id: 1,
  sender: "staff",
  sender_name: "Arman",
  sender_role: "manager",
  body: "Не запускается сессия",
  delivery: "queued",
  delivery_error: null,
  read_at: null,
  created_at: "2026-08-31T10:00:00Z",
  attachments: [],
  ...over,
});

describe("mergeMessage", () => {
  test("a message not in the thread is appended", () => {
    expect(mergeMessage([msg(1)], msg(2)).map((m) => m.id)).toEqual([1, 2]);
  });

  test("a replayed message does not double the line", () => {
    const out = mergeMessage([msg(1), msg(2)], msg(2));
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.id)).toEqual([1, 2]);
  });

  test("a re-announcement updates the line in place, keeping its position", () => {
    const out = mergeMessage([msg(1), msg(2), msg(3)], msg(2, { delivery: "sent" }));

    expect(out.map((m) => m.id)).toEqual([1, 2, 3]);
    expect(out[1].delivery).toBe("sent");
    // And the ones around it are untouched.
    expect(out[0].delivery).toBe("queued");
    expect(out[2].delivery).toBe("queued");
  });

  test("a failure reaches the bubble the same way, with its reason", () => {
    const out = mergeMessage([msg(9)], msg(9, { delivery: "failed", delivery_error: "chat not found" }));

    expect(out).toHaveLength(1);
    expect(out[0].delivery).toBe("failed");
    expect(out[0].delivery_error).toBe("chat not found");
  });

  test("the original array is never mutated", () => {
    const before = [msg(1)];
    mergeMessage(before, msg(1, { delivery: "sent" }));
    expect(before[0].delivery).toBe("queued");
  });
});

/**
 * When a message stops being able to claim it is on its way.
 *
 * A `queued` message is one the server accepted and handed to the worker that
 * carries it to Telegram. Normally that takes a second. When no worker is
 * running — a deployment where nobody started it, or one whose queue moved off
 * `sync` — the row stays `queued` for good, and the screen went on saying
 * "reaching support…" for hours. Someone had written about a problem and had no
 * way to know that nobody would see it.
 *
 * Measured against the real thing: a message written at 22:41 was still
 * `queued` forty minutes later, while messages from two days earlier were
 * `sent`. The transport was fine; nothing was consuming the queue.
 */
describe("a delivery that has stopped moving", () => {
  const at = (over: Partial<ISupportMessage> = {}): ISupportMessage =>
    msg(1, { sender: "staff", delivery: "queued", created_at: "2026-09-01T22:41:29+04:00", ...over });

  const T = Date.parse("2026-09-01T22:41:29+04:00");

  test("a fresh message is still on its way", () => {
    expect(isStuckInDelivery(at(), T + 5_000)).toBe(false);
  });

  test("past the window it is not", () => {
    expect(isStuckInDelivery(at(), T + DELIVERY_STUCK_AFTER_MS + 1_000)).toBe(true);
  });

  test("a message that reached support is never stuck", () => {
    expect(isStuckInDelivery(at({ delivery: "sent" }), T + 3_600_000)).toBe(false);
  });

  test("support's own messages have nothing to deliver", () => {
    // They arrive FROM Telegram; there is no outbound leg to be waiting on.
    expect(isStuckInDelivery(at({ sender: "support", delivery: "queued" }), T + 3_600_000)).toBe(false);
  });

  test("a row with no timestamp is not accused of anything", () => {
    expect(isStuckInDelivery(at({ created_at: null }), T + 3_600_000)).toBe(false);
  });
});


/**
 * A message too big for one Reverb frame (2026-11-14, backend): the event
 * arrives with `body: null` and `body_truncated: true`. Rendering it would put
 * an empty bubble in the thread; the thread is read again instead and the
 * message comes from that answer. Normal events carry no flag and are folded
 * in as before.
 */
describe("a truncated arrival", () => {
  test("only an event flagged body_truncated asks for the thread again", () => {
    expect(arrivalNeedsRefetch(msg(1, { body: null, body_truncated: true }))).toBe(true);
    expect(arrivalNeedsRefetch(msg(1))).toBe(false);
    expect(arrivalNeedsRefetch(msg(1, { body: null }))).toBe(false); // an attachment-only line
    expect(arrivalNeedsRefetch(msg(1, { body_truncated: false }))).toBe(false);
  });

  test("the thread's answer replaces what is on screen, the full body included", () => {
    const onScreen = [msg(1), msg(2, { delivery: "queued" })];
    const snapshot = [msg(1), msg(2, { delivery: "sent" }), msg(3, { sender: "support", body: "я".repeat(3000) })];
    const out = reconcileThread(onScreen, snapshot);
    expect(out.map((m) => m.id)).toEqual([1, 2, 3]);
    expect(out[1].delivery).toBe("sent");
    expect(out[2].body).toHaveLength(3000);
  });

  test("a line that arrived while the thread was being read is kept", () => {
    const onScreen = [msg(1), msg(4, { body: "just now" })];
    const snapshot = [msg(1), msg(3)];
    expect(reconcileThread(onScreen, snapshot).map((m) => m.id)).toEqual([1, 3, 4]);
  });
});
