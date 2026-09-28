import { describe, expect, test } from "vitest";
import type { ISessionEvent } from "@/api/sessions";
import {
  HISTORY_FOLD_ABOVE,
  eventDetailParts,
  eventPresentation,
  feedCoversSession,
  foldedIndexes,
  groupBySession,
} from "./sessionHistoryModel";

/**
 * How the history card reads an event, folds a long history and decides
 * whether the branch feed already holds a session's events. The per-action
 * wording is pinned in routes/SessionsHistory.test.tsx.
 */

const t = (k: string) => (k.startsWith("history.action.") && k.endsWith("brand_new") ? "" : k);
const money = (n: number) => `${n} AMD`;

const event = (over: Partial<ISessionEvent>): ISessionEvent => ({
  id: 1, session_id: 7, branch_id: 1, action: "started", amount: null, meta: null,
  created_at: "2026-09-26T12:56:00+04:00", ...over,
});

describe("eventPresentation", () => {
  test("a known action: its label, its tone, its actor, its details", () => {
    const p = eventPresentation(event({ action: "paused", user: { id: 1, name: "Giorgi", role: "manager" } }), t, money);
    expect(p).toEqual({ title: "history.action.paused", tone: "pause", icon: "❚❚", actor: "Giorgi", details: [] });
  });

  test("the server's resume at the pause limit is its own entry, never a cashier's press", () => {
    const auto = eventPresentation(
      event({ action: "resumed", meta: { reason: "pause_limit", paused_seconds: 60 } }),
      t,
      money,
    );
    expect(auto.title).toBe("history.autoResumeTitle");
    expect(auto.tone).toBe("auto");
    expect(auto.actor).toBe("history.endedAutomatically");
    expect(auto.details).toEqual(["history.pauseLimitReason", "history.pausedFor: 1 time.minShort"]);

    const pressed = eventPresentation(
      event({ action: "resumed", user: { id: 2, name: "Ani", role: "manager" }, meta: { paused_seconds: 60 } }),
      t,
      money,
    );
    expect(pressed.title).toBe("history.action.resumed");
    expect(pressed.tone).toBe("resume");
    expect(pressed.actor).toBe("Ani");
  });

  test("an action this build has never heard of still reads: a name, and its plain meta", () => {
    const p = eventPresentation(
      event({
        action: "brand_new" as ISessionEvent["action"],
        amount: 500,
        meta: { console_state: "rest", attempts: 2, ok: true, nested: { a: 1 }, list: [1] },
      }),
      t,
      money,
    );
    expect(p.title).toBe("Brand new");
    expect(p.tone).toBe("neutral");
    expect(p.details).toEqual(["Console state: rest", "Attempts: 2", "Ok: true"]);
  });

  test("no actor recorded is no actor line, not an empty one", () => {
    expect(eventPresentation(event({ action: "stopped", user: null }), t, money).actor).toBeNull();
  });

  test("an unknown action with no meta has no details", () => {
    expect(eventPresentation(event({ action: "brand_new" as ISessionEvent["action"] }), t, money).details).toEqual([]);
  });
});

describe("eventDetailParts — the bill's lines", () => {
  test("each product on its own line with the server's quantity, after the count", () => {
    const parts = eventDetailParts(
      event({
        action: "item_added",
        amount: 3400,
        meta: { count: 6, lines: [{ name: "Cola 0.5L", price: 600, qty: 5 }, { name: "Lays", price: 400, qty: 1 }] },
      }),
      t,
      money,
    );
    expect(parts).toEqual(["history.itemsCount: 6", "Cola 0.5L × 5", "Lays × 1"]);
  });

  test("a line with no quantity keeps its name alone", () => {
    const parts = eventDetailParts(event({ action: "item_added", meta: { lines: [{ name: "Tea" }] } }), t, money);
    expect(parts).toEqual(["Tea"]);
  });

  test("a 100-character product name is passed through whole", () => {
    const long = "Energy drink ".repeat(8).trim();
    const parts = eventDetailParts(event({ action: "item_added", meta: { lines: [{ name: long, qty: 1 }] } }), t, money);
    expect(parts).toEqual([`${long} × 1`]);
  });
});

describe("foldedIndexes", () => {
  test(`up to ${HISTORY_FOLD_ABOVE} events nothing folds`, () => {
    for (const n of [0, 1, 2, HISTORY_FOLD_ABOVE]) {
      const { shown, hidden } = foldedIndexes(n);
      expect(hidden).toBe(0);
      expect(shown.size).toBe(n);
    }
  });

  test("above it, the first three and the last two stay; the count hidden is the rest", () => {
    const eight = foldedIndexes(HISTORY_FOLD_ABOVE + 1);
    expect([...eight.shown].sort((a, b) => a - b)).toEqual([0, 1, 2, 6, 7]);
    expect(eight.hidden).toBe(3);

    const many = foldedIndexes(500);
    expect([...many.shown].sort((a, b) => a - b)).toEqual([0, 1, 2, 498, 499]);
    expect(many.hidden).toBe(495);
  });
});

describe("groupBySession", () => {
  test("never mixes two sessions' events", () => {
    const g = groupBySession([
      event({ id: 1, session_id: 7 }),
      event({ id: 2, session_id: 8 }),
      event({ id: 3, session_id: 7 }),
    ]);
    expect(g.get(7)?.map((e) => e.id)).toEqual([1, 3]);
    expect(g.get(8)?.map((e) => e.id)).toEqual([2]);
    expect(g.get(9)).toBeUndefined();
  });
});

describe("feedCoversSession", () => {
  const to = "2026-09-26T19:59:59.999Z";
  const closed = (stopped_at: string) => ({ status: "stopped" as const, stopped_at, ends_at: stopped_at });
  const running = { status: "active" as const, stopped_at: null, ends_at: null };
  const started = [event({ action: "started" })];

  test("a session closed inside the range, from a feed that was not cut, is whole", () => {
    expect(feedCoversSession(closed("2026-09-26T10:00:00Z"), [], { truncated: false, to, now: 0 })).toBe(true);
  });

  test("a session closed after the range ends is not — its last events are outside it", () => {
    expect(feedCoversSession(closed("2026-09-27T01:00:00Z"), started, { truncated: false, to, now: 0 })).toBe(false);
  });

  test("a running session is whole while the range still reaches now, not after", () => {
    const now = new Date("2026-09-26T12:00:00Z").getTime();
    expect(feedCoversSession(running, started, { truncated: false, to, now })).toBe(true);
    expect(feedCoversSession(running, started, { truncated: false, to: "2026-09-25T19:59:59Z", now })).toBe(false);
  });

  test("from a cut feed, only a session whose own start made it in", () => {
    const s = closed("2026-09-26T10:00:00Z");
    expect(feedCoversSession(s, started, { truncated: true, to, now: 0 })).toBe(true);
    expect(feedCoversSession(s, [event({ action: "stopped" })], { truncated: true, to, now: 0 })).toBe(false);
    expect(feedCoversSession(s, [], { truncated: true, to, now: 0 })).toBe(false);
  });

  test("an expired session with no end time recorded is not vouched for", () => {
    expect(feedCoversSession({ status: "expired", stopped_at: null, ends_at: null }, started, { truncated: false, to, now: 0 })).toBe(false);
  });
});
