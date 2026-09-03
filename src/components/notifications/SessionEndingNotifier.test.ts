import { describe, expect, it } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { sessionsToWarnAbout } from "./SessionEndingNotifier";

const NOW = new Date("2026-09-03T14:00:00.000Z").getTime();
const inMinutes = (m: number): string => new Date(NOW + m * 60_000).toISOString();

const session = (over: Partial<ISessionApi>): ISessionApi => ({
  id: 1,
  branch_id: 7,
  pc_id: 21,
  pc_label: "№1",
  started_at: new Date(NOW - 3_000_000).toISOString(),
  ends_at: inMinutes(60),
  status: "active",
  total_paid: 0,
  ...over,
});

/**
 * The rule behind the ten-minute warning, asserted without React or a fake
 * clock in a DOM. Three things have to be true of it, and each one is a way an
 * operator's evening gets worse if it is not:
 *
 *   - it fires in time to be useful and not after the fact;
 *   - it fires ONCE, so granting time does not summon it again;
 *   - it never fires for a session that cannot run out at all.
 */
describe("which sessions are about to run out", () => {
  it("warns inside the last ten minutes and not before", () => {
    const due = sessionsToWarnAbout(
      [
        session({ id: 1, ends_at: inMinutes(10) }),
        session({ id: 2, ends_at: inMinutes(9) }),
        session({ id: 3, ends_at: inMinutes(11) }),
        session({ id: 4, ends_at: inMinutes(59) }),
      ],
      new Set(),
      NOW,
    );

    expect(due.map((d) => d.sessionId)).toEqual([1, 2]);
  });

  it("does not warn about one that has already ended", () => {
    // The board turns the tile over on its own, and there is nothing left to
    // sell — a warning here is news, not a chance to act.
    const due = sessionsToWarnAbout([session({ ends_at: inMinutes(-1) })], new Set(), NOW);

    expect(due).toEqual([]);
  });

  it("says nothing about a session that cannot run out", () => {
    // Count-up mode, and one an operator has already lifted the ceiling on.
    const due = sessionsToWarnAbout(
      [
        session({ id: 1, ends_at: null }),
        session({ id: 2, ends_at: inMinutes(5), is_unlimited: true }),
      ],
      new Set(),
      NOW,
    );

    expect(due).toEqual([]);
  });

  it("warns once per session, so granting time does not summon it again", () => {
    const already = new Set([1]);

    const due = sessionsToWarnAbout(
      [session({ id: 1, ends_at: inMinutes(5) }), session({ id: 2, ends_at: inMinutes(5) })],
      already,
      NOW,
    );

    expect(due.map((d) => d.sessionId)).toEqual([2]);
  });

  it("ignores a session that is no longer active", () => {
    const due = sessionsToWarnAbout(
      [session({ status: "stopped", ends_at: inMinutes(5) })],
      new Set(),
      NOW,
    );

    expect(due).toEqual([]);
  });

  it("carries the venue and the seat, so the card can name them and link to them", () => {
    const [due] = sessionsToWarnAbout(
      [session({ id: 9, branch_id: 3, pc_label: "PS5 VIP", ends_at: inMinutes(4) })],
      new Set(),
      NOW,
    );

    expect(due).toEqual({ sessionId: 9, branchId: 3, label: "PS5 VIP", minutesLeft: 4 });
  });
});
