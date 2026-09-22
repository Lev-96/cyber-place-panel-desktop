import { describe, expect, test } from "vitest";
import { eventDetail, eventSeat, paymentLabelOf, segmentsOf } from "./SessionsHistory";
// The pad line is shared with the board now, so its tests follow it there.
import { padChargeOf } from "@/components/sessions/joystickView";
import type { ISessionEvent } from "@/api/sessions";
import type { ISessionApi } from "@/types/sessions";

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

  test("prefers the server's played-before figure over subtracting timestamps", () => {
    // ⚠️ Both are present and they DISAGREE. The server's must win: it was
    // computed inside the move's own transaction, and the subtraction is only
    // a fallback for rows written before that field existed.
    const line = eventDetail(
      event({
        action: "moved",
        created_at: "2026-09-10T15:20:00+04:00",
        meta: {
          from_place_number: 2,
          to_place_number: 5,
          session_started_at: "2026-09-10T14:00:00+04:00",
          played_minutes_before: 31,
        },
      }),
      t,
      money,
    );

    expect(line).toContain("31 time.minShort");
    expect(line).not.toContain("1 time.hourShort 20 time.minShort");
  });

  test("says what the seat that was left had run up", () => {
    const line = eventDetail(
      event({
        action: "moved",
        meta: { from_place_number: 2, to_place_number: 5, total_before: 1750 },
      }),
      t,
      money,
    );

    expect(line).toContain("history.totalBeforeMove: 1750 AMD");
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
  /**
   * A pad priced by the HOUR says so on its own log line.
   *
   * Without the marker the feed printed "Price for one: 500 AMD" on a pad that
   * put about nothing on the bill at that instant and would reach 500 only
   * after a full hour. The rate and the fee are different facts and used to
   * print identically.
   */
  test("an hourly add marks its figure as a rate", () => {
    const line = eventDetail(
      event({
        action: "joystick_added",
        amount: 500,
        meta: { slot: 3, price: 500, count_before: 2, count_after: 3, hourly: true },
      }),
      t,
      money,
    );

    expect(line).toContain("history.padUnitPrice: 500 AMDsession.perHourShort");
  });

  test("a fee add does not", () => {
    const line = eventDetail(
      event({
        action: "joystick_added",
        amount: 500,
        meta: { slot: 3, price: 500, count_before: 2, count_after: 3, hourly: false },
      }),
      t,
      money,
    );

    expect(line).toContain("history.padUnitPrice: 500 AMD");
    expect(line).not.toContain("session.perHourShort");
  });

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

describe("the bill's own lines", () => {
  test("a sale names what was sold and how many", () => {
    const line = eventDetail(
      event({
        action: "item_added",
        amount: 1000,
        meta: { count: 2, items_total: 1000, lines: [{ name: "Cola", price: 500, qty: 2 }] },
      }),
      t,
      money,
    );

    expect(line).toContain("history.itemsCount: 2");
    expect(line).toContain("Cola");
  });

  test("a removal says plainly that nothing came back", () => {
    const line = eventDetail(
      event({
        action: "item_removed",
        amount: 0,
        meta: { count: 1, items_total: 500, lines: [{ name: "Cola", price: 500, qty: 1 }] },
      }),
      t,
      money,
    );

    expect(line).toContain("history.noRefundShort");
  });

  test("a malformed lines array does not break the row", () => {
    // `meta` is JSON from the server; a shape this file did not write can
    // still arrive, and a history that throws shows nothing at all.
    const line = eventDetail(
      event({ action: "item_added", meta: { count: 1, lines: [null, 7, { qty: 2 }] } }),
      t,
      money,
    );

    expect(line).toBe("history.itemsCount: 1");
  });

  /**
   * A return is NOT a removal, and the row has to say the difference: the line
   * stays on the bill with what it earned while it was out, so the only two
   * facts worth the width are how long that was and that no money came back.
   */
  test("a return says how long it was out and that nothing came back", () => {
    const line = eventDetail(
      event({
        action: "item_returned",
        amount: 0,
        meta: { count: 1, minutes: 90, lines: [{ name: "\u041a\u0438\u0439", price: 700, qty: 1, extra: true }] },
      }),
      t,
      money,
    );

    expect(line).toContain("\u041a\u0438\u0439");
    expect(line).toContain("90 time.minShort");
    expect(line).toContain("history.noRefundShort");
  });
});

describe("the two refusals", () => {
  test("a refused grant says how much was asked for and why not", () => {
    const line = eventDetail(
      event({
        action: "time_add_refused",
        meta: { minutes: 30, reason: "seat_unavailable", max_minutes: 10 },
      }),
      t,
      money,
    );

    expect(line).toContain("+30 time.minShort");
    expect(line).toContain("history.seatBooked");
    // ⚠️ And what the seat COULD still take, which is the cashier's next move.
    expect(line).toContain("+10 time.minShort");
  });

  test("a refused move says the seat was taken first", () => {
    const line = eventDetail(
      event({
        action: "move_failed",
        meta: { from_place_number: 2, to_place_id: 5, minutes: 30, reason: "target_taken", status: 409 },
      }),
      t,
      money,
    );

    expect(line).toContain("№2");
    expect(line).toContain("history.seatTaken");
  });
});

describe("which seat a line was written on", () => {
  test("the frozen number wins over the row's own fields", () => {
    // ⚠️ `place_name` here is what the resource resolved from the session's
    // CURRENT device — №5, after the move. The line was written on №2, and the
    // frozen value is the one that says so.
    const seat = eventSeat(
      event({ action: "item_added", meta: { place_number: 2 }, place_name: "Seat 5" } as never),
    );

    expect(seat).toBe("№2");
  });

  test("an old line with nothing frozen still shows what it can", () => {
    expect(eventSeat(event({ action: "started", meta: null, place_name: "Seat 5" } as never))).toBe("Seat 5");
    expect(eventSeat(event({ action: "started", meta: null, pc_label: "PS4-08" } as never))).toBe("PS4-08");
    expect(eventSeat(event({ action: "started", meta: null } as never))).toBeNull();
  });
});

describe("how the money was taken", () => {
  const paid = (over: Record<string, unknown>) =>
    paymentLabelOf(over as never, t);

  test("cash and card read as words", () => {
    expect(paid({ payment_method: "cash" })).toBe("session.payCash");
    expect(paid({ payment_method: "card" })).toBe("session.payCard");
  });

  test("another method prints what the cashier typed, not the word 'other'", () => {
    expect(paid({ payment_method: "other", payment_method_other: "Idram" })).toBe("Idram");
  });

  test("a long custom method is passed through whole", () => {
    // Layout is the CSS's problem; truncating here would lose the answer.
    const long = "Перевод через банк на счёт компании, квитанция у администратора";
    expect(paid({ payment_method: "other", payment_method_other: long })).toBe(long);
  });

  test("nothing recorded shows nothing at all", () => {
    // ⚠️ Every session stopped before this existed, and every running one.
    // A bold empty gap under "Payment method" reads as a fault.
    expect(paid({})).toBeNull();
    expect(paid({ payment_method: null })).toBeNull();
    expect(paid({ payment_method: "other", payment_method_other: null })).toBeNull();
    expect(paid({ payment_method: "other", payment_method_other: "   " })).toBeNull();
  });
});

describe("cutting one session into the seats it was played on", () => {
  const at = (iso: string, over: Partial<ISessionEvent> = {}) =>
    event({ created_at: iso, ...over });

  test("a session that never moved is one segment", () => {
    const segments = segmentsOf([
      at("2026-09-10T12:00:00+04:00", { id: 1, action: "started", meta: { place_number: 2 } }),
      at("2026-09-10T12:10:00+04:00", { id: 2, action: "item_added", meta: { place_number: 2 } }),
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].seat).toBe("№2");
    expect(segments[0].events).toHaveLength(2);
  });

  test("a move closes the seat it happened on and opens the next", () => {
    const segments = segmentsOf([
      at("2026-09-10T12:00:00+04:00", { id: 1, action: "started", meta: { place_number: 2 } }),
      at("2026-09-10T12:31:00+04:00", {
        id: 2,
        action: "moved",
        meta: { place_number: 2, from_place_number: 2, to_place_number: 5 },
      }),
      at("2026-09-10T12:40:00+04:00", { id: 3, action: "joystick_added", meta: { place_number: 5 } }),
    ]);

    expect(segments.map((s) => s.seat)).toEqual(["№2", "№5"]);
    // ⚠️ The move belongs to the seat being LEFT. That is where a reader looks
    // for it, and it is where it was performed.
    expect(segments[0].events.map((e) => e.action)).toEqual(["started", "moved"]);
    expect(segments[1].events.map((e) => e.action)).toEqual(["joystick_added"]);
  });

  test("two moves make three segments", () => {
    const segments = segmentsOf([
      at("2026-09-10T12:00:00+04:00", { id: 1, action: "started", meta: { place_number: 2 } }),
      at("2026-09-10T12:31:00+04:00", { id: 2, action: "moved", meta: { place_number: 2, to_place_number: 5 } }),
      at("2026-09-10T13:00:00+04:00", { id: 3, action: "moved", meta: { place_number: 5, to_place_number: 9 } }),
      at("2026-09-10T13:10:00+04:00", { id: 4, action: "stopped", meta: { place_number: 9 } }),
    ]);

    expect(segments.map((s) => s.seat)).toEqual(["№2", "№5", "№9"]);
  });

  test("order comes from the server's timestamp, never from the array", () => {
    // Handed back newest-first, which is how the branch feed arrives.
    const segments = segmentsOf([
      at("2026-09-10T12:40:00+04:00", { id: 3, action: "joystick_added", meta: { place_number: 5 } }),
      at("2026-09-10T12:31:00+04:00", { id: 2, action: "moved", meta: { place_number: 2, to_place_number: 5 } }),
      at("2026-09-10T12:00:00+04:00", { id: 1, action: "started", meta: { place_number: 2 } }),
    ]);

    expect(segments.map((s) => s.seat)).toEqual(["№2", "№5"]);
    expect(segments[0].events[0].action).toBe("started");
  });

  test("an old session whose lines never named a seat still reads", () => {
    // ⚠️ Backward compatibility: rows written before the seat was frozen have
    // nothing to group by, and one anonymous segment is the honest answer.
    const segments = segmentsOf([
      at("2026-09-10T12:00:00+04:00", { id: 1, action: "started", meta: null }),
      at("2026-09-10T12:10:00+04:00", { id: 2, action: "time_added", meta: { minutes: 30 } }),
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].seat).toBeNull();
    expect(segments[0].events).toHaveLength(2);
  });

  test("no events is no segments, not one empty one", () => {
    expect(segmentsOf([])).toEqual([]);
  });

  test("a move with no destination recorded does not invent one", () => {
    const segments = segmentsOf([
      at("2026-09-10T12:00:00+04:00", { id: 1, action: "started", meta: { place_number: 2 } }),
      at("2026-09-10T12:31:00+04:00", { id: 2, action: "moved", meta: { place_number: 2 } }),
      at("2026-09-10T12:40:00+04:00", { id: 3, action: "stopped", meta: null }),
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[1].seat).toBeNull();
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


describe("what a finished session's pads cost", () => {
  const session = (over: Partial<ISessionApi> = {}): ISessionApi => ({
    id: 7, branch_id: 1, pc_id: 1, status: "stopped", mode: "open",
    started_at: "2026-09-01T10:00:00.000Z",
    stopped_at: "2026-09-01T11:00:00.000Z",
    total_paid: 1500, is_free: false,
    ...over,
  } as ISessionApi);

  // Dates in the PAST deliberately. The figure clamps an open-ended period to
  // "now", so a fixture dated in the future measures a negative interval and
  // every hourly assertion quietly reads zero.
  const pad = (over: Record<string, unknown> = {}) => ({
    id: 1, slot: 3, price: 500, is_charged: true,
    started_at: "2026-09-01T10:00:00.000Z", stopped_at: "2026-09-01T11:00:00.000Z",
    ...over,
  });

  /**
   * A rate and a fee print identically without this, and they are different
   * facts: "2 × 500 = 1000" is what a fee model took, "2 × 500/h = 250" is what
   * an hourly one did. A month later nobody can tell them apart from the figure.
   */
  /**
   * A slot is an identity, so the charge names it rather than multiplying by
   * a count. The same slot used twice is one identity and two periods.
   */
  test("names the pads by number, deduped and in order", () => {
    const charge = padChargeOf(session({
      joysticks: [
        pad({ id: 1, slot: 4 }),
        pad({ id: 2, slot: 3 }),
        pad({ id: 3, slot: 3 }),
      ],
    } as Partial<ISessionApi>));

    expect(charge?.slots).toEqual([3, 4]);
    expect(charge?.count).toBe(3);
  });

  test("an hourly session says its unit figure is a rate", () => {
    const charge = padChargeOf(session({ joysticks: [pad({ is_hourly: true })] } as Partial<ISessionApi>));

    expect(charge?.hourly).toBe(true);
    expect(charge?.each).toBe(500);
    // One hour at 500/h: the interval's share, not the whole rate.
    expect(charge?.total).toBeCloseTo(500, 2);
  });

  test("a fee session does not", () => {
    const charge = padChargeOf(session({ joysticks: [pad({ is_hourly: false })] } as Partial<ISessionApi>));

    expect(charge?.hourly).toBe(false);
    expect(charge?.total).toBeCloseTo(500, 2);
  });

  /**
   * A payload from a backend that predates the flag must not be labelled a
   * rate. Absent is not "hourly": it is "this backend does not say", and the
   * fee model is what such a backend actually ran.
   */
  test("a period that does not say is not called a rate", () => {
    const charge = padChargeOf(session({ joysticks: [pad()] } as Partial<ISessionApi>));

    expect(charge?.hourly).toBe(false);
  });

  /** One rate and one fee on the same seat is not a rate. */
  test("mixed periods read as a fee, because the unit figure is not a rate for all of them", () => {
    const charge = padChargeOf(session({
      joysticks: [pad({ is_hourly: true }), pad({ id: 2, slot: 4, is_hourly: false })],
    } as Partial<ISessionApi>));

    expect(charge?.hourly).toBe(false);
    expect(charge?.count).toBe(2);
  });

  test("a waived seat quotes no pad figure at all", () => {
    expect(padChargeOf(session({ is_free: true, joysticks: [pad()] } as Partial<ISessionApi>))).toBeNull();
  });

  test("a seat that was charged for nothing quotes none either", () => {
    expect(padChargeOf(session({ joysticks: [pad({ is_charged: false })] } as Partial<ISessionApi>))).toBeNull();
  });

  /** Two periods frozen at different fees have no single unit figure to quote. */
  test("periods that disagree on a price quote the sum alone", () => {
    const charge = padChargeOf(session({
      joysticks: [pad(), pad({ id: 2, slot: 4, price: 700 })],
    } as Partial<ISessionApi>));

    expect(charge?.each).toBeNull();
    expect(charge?.total).toBeCloseTo(1200, 2);
  });
});
