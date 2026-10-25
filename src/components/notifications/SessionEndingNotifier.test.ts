import { describe, expect, test } from "vitest";
import type { IDbNotification } from "@/api/notifications";
import { endingWarnings } from "./SessionEndingNotifier";

/**
 * Which "about to run out" warnings to show — the SERVER's notifications
 * (2026-10-25). Nothing here decides when a seat is ending: an unread
 * `session.ending_soon` row whose seat has not run out yet, not dismissed.
 */
const NOW = Date.parse("2026-10-25T12:00:00Z");
const row = (id: string, minutesAhead: number, over: Partial<IDbNotification> = {}, data: Record<string, unknown> = {}): IDbNotification => ({
  id,
  type: "App\\Notifications\\SessionEndingSoon",
  read_at: null,
  created_at: new Date(NOW).toISOString(),
  data: {
    type: "session.ending_soon", session_id: Number(id.replace(/\D/g, "")) || 1, branch_id: 7, pc_id: 3, place_number: 4,
    ends_at: new Date(NOW + minutesAhead * 60_000).toISOString(), minutes_left: 15, ...data,
  },
  ...over,
});

describe("endingWarnings", () => {
  test("an unread warning still ahead is shown, with the seat and the minutes left", () => {
    expect(endingWarnings([row("n1", 15)], new Set(), NOW)).toEqual([
      { id: "n1", sessionId: 1, branchId: 7, label: "№4", minutesLeft: 15 },
    ]);
  });

  test("minutes are counted from the server's end, so a restart reads the truth", () => {
    expect(endingWarnings([row("n1", 6)], new Set(), NOW)[0].minutesLeft).toBe(6);
  });

  test("read, dismissed, past its end, or another kind: not shown", () => {
    const list = [
      row("n1", 10, { read_at: new Date(NOW).toISOString() }),
      row("n2", 10),
      row("n3", -1),
      row("n4", 10, {}, { type: "booking.created" }),
    ];
    expect(endingWarnings(list, new Set(["n2"]), NOW)).toEqual([]);
  });

  test("soonest first", () => {
    const ids = endingWarnings([row("n1", 12), row("n2", 4), row("n3", 9)], new Set(), NOW).map((w) => w.id);
    expect(ids).toEqual(["n2", "n3", "n1"]);
  });

  test("a seat with no number is named by its device", () => {
    expect(endingWarnings([row("n1", 5, {}, { place_number: null })], new Set(), NOW)[0].label).toBe("#3");
  });
});
