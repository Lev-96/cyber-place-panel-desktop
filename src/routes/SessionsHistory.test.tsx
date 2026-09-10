import { describe, expect, test } from "vitest";
import { eventDetail } from "./SessionsHistory";
import type { ISessionEvent } from "@/api/sessions";

/**
 * What a line in the session's audit log actually SAYS.
 *
 * ⚠️ The backend has written all of this since each feature shipped —
 * `SessionAuditLogger` stores a `meta` blob on every event with the seats a
 * move went between, the minutes a grant was worth, the fee a pad was charged
 * at. The history printed the action's NAME and threw the rest away, so an
 * owner reading "Moved the session" learned that something moved and nothing
 * else. These pin the reading of that blob.
 *
 * Nothing here is computed that the server did not state. The single derived
 * value is the time played before a move, and both of its terms are server
 * timestamps.
 */

// `t` echoes the key, so the assertions stay about structure rather than copy.
const t = (k: string) => k;
const money = (n: number) => `${n} AMD`;

const event = (over: Partial<ISessionEvent>): ISessionEvent => ({
  id: 1,
  session_id: 7,
  branch_id: 1,
  action: "started",
  amount: null,
  meta: null,
  created_at: "2026-09-10T15:20:00+04:00",
  ...over,
});

describe("a seat migration", () => {
  test("names the seat it left and the seat it went to", () => {
    const line = eventDetail(
      event({
        action: "moved",
        meta: { from_place_number: 4, to_place_number: 6 },
      }),
      t,
      money,
    );

    expect(line).toContain("№4 -> №6");
  });

  test("says how long the player had already been in, from server timestamps", () => {
    // Started 14:00, moved 15:20 — the event's own `created_at` against the
    // `session_started_at` the move recorded. No frontend timer is involved.
    const line = eventDetail(
      event({
        action: "moved",
        created_at: "2026-09-10T15:20:00+04:00",
        meta: {
          from_place_number: 4,
          to_place_number: 6,
          session_started_at: "2026-09-10T14:00:00+04:00",
        },
      }),
      t,
      money,
    );

    expect(line).toContain("history.playedBeforeMove");
    expect(line).toContain("1 time.hourShort 20 time.minShort");
  });

  test("carries the grant the move was made for", () => {
    const line = eventDetail(
      event({
        action: "moved",
        meta: { from_place_number: 4, to_place_number: 6, requested_minutes: 30 },
      }),
      t,
      money,
    );

    expect(line).toContain("+30 time.minShort");
  });
});

describe("added time", () => {
  test("leads with the minutes, not with a timestamp", () => {
    const line = eventDetail(
      event({ action: "time_added", meta: { minutes: 30, new_ends_at: "2026-09-10T16:00:00+04:00" } }),
      t,
      money,
    );

    // ⚠️ "+30 min" first. A new end instant alone makes a reader subtract to
    // find out what was sold.
    expect(line?.startsWith("+30 time.minShort")).toBe(true);
    expect(line).toContain("history.untilLabel");
  });
});

describe("the tariff going unlimited", () => {
  test("reads as a change, not as a destination", () => {
    const line = eventDetail(
      event({ action: "made_unlimited", meta: { old_mode: "fixed", hourly_rate: 500 } }),
      t,
      money,
    );

    expect(line).toContain("fixed -> session.unlimited");
    expect(line).toContain("500 AMD");
  });
});

describe("joysticks", () => {
  test("an add says how many there are now and what one costs", () => {
    const line = eventDetail(
      event({
        action: "joystick_added",
        amount: 500,
        meta: { slot: 2, price: 500, count_before: 1, count_after: 2 },
      }),
      t,
      money,
    );

    expect(line).toContain("history.padsNow: 2");
    expect(line).toContain("history.padUnitPrice: 500 AMD");
    // ⚠️ And NOT an interval. A pad is billed at a flat fee; printing the
    // minutes it was plugged in suggests it is priced by time.
    expect(line).not.toContain("->");
  });

  test("a removal says plainly that nothing came back", () => {
    const line = eventDetail(
      event({ action: "joystick_removed", amount: 0, meta: { slot: 2, count_after: 1, minutes: 3 } }),
      t,
      money,
    );

    expect(line).toContain("history.padNoRefund");
  });
});

describe("rows written before any of this existed", () => {
  test("an event with no meta renders as the plain action it always was", () => {
    for (const action of ["moved", "time_added", "joystick_added", "made_unlimited"] as const) {
      expect(eventDetail(event({ action, meta: null }), t, money)).toBeNull();
    }
  });

  test("a partial meta uses what is there and skips what is not", () => {
    const line = eventDetail(
      event({ action: "moved", meta: { from_place_number: 4, to_place_number: 6 } }),
      t,
      money,
    );

    expect(line).toBe("№4 -> №6");
  });

  test("an action with nothing extra to say adds no second line", () => {
    expect(eventDetail(event({ action: "started" }), t, money)).toBeNull();
    expect(eventDetail(event({ action: "stopped", amount: 4200 }), t, money)).toBeNull();
  });

  test("a string number out of JSON is read as a number", () => {
    // `meta` is a JSON column; a value can come back as "6" rather than 6.
    const line = eventDetail(
      event({ action: "moved", meta: { from_place_number: "4", to_place_number: "6" } }),
      t,
      money,
    );

    expect(line).toBe("№4 -> №6");
  });
});
