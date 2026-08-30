import { describe, expect, test } from "vitest";
import { mergeMessage } from "./SupportChat";
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
