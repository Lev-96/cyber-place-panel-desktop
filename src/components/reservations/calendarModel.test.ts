import { describe, expect, test } from "vitest";
import type { StaffReservation } from "@/domain/StaffReservation";
import {
  addDays, assignLanes, bookingCounts, clip, clubDayBounds, clubDayOf, dayBookings, fetchRange, hm, isSameDay,
  parseYmd, roundUpToStep, seatBlocks, slotAt, startSeatOf, stripDays, timelineWindow, ymd,
} from "./calendarModel";

/** The bookings calendar's arithmetic (2026-11-07): club days, the strip, the timeline window, blocks, Start. */

const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s);

const res = (id: number, start: Date, minutes: number, extra: Partial<StaffReservation> = {}): StaffReservation => ({
  id, status: "pending", booking_date: ymd(start), start_time: "00:00", duration_minutes: minutes,
  starts_at: start.toISOString(), ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
  place_ids: [1], contact_name: null, contact_phone: null, guest_name: null, source: "staff", session_id: null,
  editable: true, start, end: new Date(start.getTime() + minutes * 60_000), ...extra,
});

describe("club days and the strip", () => {
  test("a club day runs 06:00 to 06:00; before 06:00 it is still yesterday's", () => {
    expect(ymd(clubDayOf(at(2026, 11, 7, 15)))).toBe("2026-11-07");
    expect(ymd(clubDayOf(at(2026, 11, 8, 1, 30)))).toBe("2026-11-07");
    expect(ymd(clubDayOf(at(2026, 11, 8, 6)))).toBe("2026-11-08");
    const { start, end } = clubDayBounds(at(2026, 11, 7));
    expect([start, end]).toEqual([at(2026, 11, 7, 6), at(2026, 11, 8, 6)]);
  });

  test("the strip is 14 days, also across a month and a year", () => {
    const days = stripDays(at(2026, 12, 25));
    expect(days.length).toBe(14);
    expect(ymd(days[0])).toBe("2026-12-25");
    expect(ymd(days[13])).toBe("2027-01-07");
  });

  test("the range asked for is the strip plus the day before and the day after", () => {
    expect(fetchRange(at(2026, 11, 7))).toEqual({ from: "2026-11-06", to: "2026-11-21" });
  });

  test("Y-m-d round trip; an impossible date is no date", () => {
    expect(ymd(parseYmd("2026-02-28") as Date)).toBe("2026-02-28");
    expect(parseYmd("2026-02-30")).toBeNull();
    expect(parseYmd("07.11.2026")).toBeNull();
    expect(isSameDay(addDays(at(2026, 11, 7, 23), 0), at(2026, 11, 7))).toBe(true);
  });

  test("now rounds UP to the next 5 minutes; a whole 5 stays", () => {
    expect(roundUpToStep(at(2026, 11, 7, 15, 2)).getMinutes()).toBe(5);
    expect(roundUpToStep(at(2026, 11, 7, 15, 5)).getMinutes()).toBe(5);
    expect(roundUpToStep(at(2026, 11, 7, 15, 5, 30)).getMinutes()).toBe(10);
    const late = roundUpToStep(at(2026, 11, 7, 23, 58));
    expect([ymd(late), late.getHours(), late.getMinutes()]).toEqual(["2026-11-08", 0, 0]);
  });
});

describe("the timeline window", () => {
  const day = at(2026, 11, 7);
  const farNow = at(2026, 11, 1, 12);

  test("08:00 to 02:00 when nothing reaches further", () => {
    const w = timelineWindow(day, [res(1, at(2026, 11, 7, 15), 60)], [], farNow);
    expect([w.start, w.end, w.minutes]).toEqual([at(2026, 11, 7, 8), at(2026, 11, 8, 2), 18 * 60]);
  });

  test("widened to whole hours for an early booking and a late night one, never past the club day", () => {
    const early = res(1, at(2026, 11, 7, 6, 30), 60);
    const late = res(2, at(2026, 11, 8, 3, 10), 300); // 03:10 to 08:10 next morning
    const w = timelineWindow(day, [early, late], [], farNow);
    expect([hm(w.start), hm(w.end), ymd(w.end)]).toEqual(["06:00", "06:00", "2026-11-08"]);
  });

  test("a cancelled booking does not widen it; now does", () => {
    const gone = res(1, at(2026, 11, 7, 6), 60, { status: "cancelled" });
    expect(hm(timelineWindow(day, [gone], [], farNow).start)).toBe("08:00");
    expect(hm(timelineWindow(day, [], [], at(2026, 11, 7, 7, 20)).start)).toBe("07:00");
    expect(hm(timelineWindow(day, [], [], at(2026, 11, 8, 3, 20)).end)).toBe("04:00");
  });

  test("a click rounds DOWN to its 15-minute slot, never past the last one", () => {
    const w = timelineWindow(day, [], [], farNow); // 08:00..02:00, 1080 minutes
    expect(hm(slotAt(w, 0))).toBe("08:00");
    expect(hm(slotAt(w, 127 / 1080))).toBe("10:00"); // 10:07
    expect(hm(slotAt(w, 133 / 1080))).toBe("10:00"); // 10:13: down, not to the nearest
    expect(hm(slotAt(w, 135 / 1080))).toBe("10:15");
    expect(hm(slotAt(w, 1))).toBe("01:45");
    expect(ymd(slotAt(w, 1))).toBe("2026-11-08");
  });
});

describe("midnight and the club day's edges", () => {
  test("23:00 to 01:00 is ONE block on its club day, not cut at midnight", () => {
    const r = res(1, at(2026, 11, 7, 23), 120);
    expect(dayBookings(at(2026, 11, 7), [r]).map((x) => x.id)).toEqual([1]);
    expect(dayBookings(at(2026, 11, 8), [r])).toEqual([]);
  });

  test("a booking over 06:00 is clipped on both club days", () => {
    const start = at(2026, 11, 8, 4);
    const end = at(2026, 11, 8, 8);
    const first = clubDayBounds(at(2026, 11, 7));
    const second = clubDayBounds(at(2026, 11, 8));
    expect(clip(start, end, first.start, first.end)).toEqual({ start, end: at(2026, 11, 8, 6), fromBefore: false, intoNext: true });
    expect(clip(start, end, second.start, second.end)).toEqual({ start: at(2026, 11, 8, 6), end, fromBefore: true, intoNext: false });
    expect(clip(at(2026, 11, 8, 2), at(2026, 11, 8, 6), second.start, second.end)).toBeNull();
  });

  test("the strip's counts: per club day, cancelled not counted", () => {
    const rows = [
      res(1, at(2026, 11, 7, 10), 60), res(2, at(2026, 11, 7, 23), 120), res(3, at(2026, 11, 8, 2), 60),
      res(4, at(2026, 11, 8, 12), 60), res(5, at(2026, 11, 8, 13), 60, { status: "cancelled" }),
    ];
    const counts = bookingCounts([at(2026, 11, 7), at(2026, 11, 8), at(2026, 11, 9)], rows);
    expect([...counts.entries()]).toEqual([["2026-11-07", 3], ["2026-11-08", 1], ["2026-11-09", 0]]);
  });

  test("the day's list is in start order", () => {
    const rows = [res(2, at(2026, 11, 7, 18), 60), res(1, at(2026, 11, 7, 9), 60), res(3, at(2026, 11, 8, 1), 60)];
    expect(dayBookings(at(2026, 11, 7), rows).map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe("lanes", () => {
  test("blocks that do not overlap all take the full height", () => {
    const lanes = assignLanes([{ key: "a", startMin: 0, endMin: 60 }, { key: "b", startMin: 60, endMin: 120 }]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get("b")).toEqual({ lane: 0, lanes: 1 });
  });

  test("two overlapping blocks share; a third after both starts a new group", () => {
    const lanes = assignLanes([
      { key: "a", startMin: 600, endMin: 720 },
      { key: "b", startMin: 660, endMin: 780 },
      { key: "c", startMin: 800, endMin: 860 },
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("c")).toEqual({ lane: 0, lanes: 1 });
  });

  test("a chain reuses a freed lane: a long block and two short ones after each other need 2 lanes, not 3", () => {
    const lanes = assignLanes([
      { key: "long", startMin: 0, endMin: 300 },
      { key: "s1", startMin: 30, endMin: 90 },
      { key: "s2", startMin: 120, endMin: 180 },
    ]);
    expect(lanes.get("long")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("s1")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("s2")).toEqual({ lane: 1, lanes: 2 });
  });
});

describe("a seat's blocks", () => {
  const day = at(2026, 11, 7);
  const now = at(2026, 11, 7, 16, 30);
  const w = timelineWindow(day, [], [], now); // 08:00..02:00

  test("bookings by minutes from the window's start; another seat's and cancelled ones left out", () => {
    const a = res(1, at(2026, 11, 7, 15), 60, { place_ids: [1] });
    const b = res(2, at(2026, 11, 7, 18), 90, { place_ids: [2] });
    const gone = res(3, at(2026, 11, 7, 12), 60, { status: "cancelled" });
    const blocks = seatBlocks(1, day, w, [a, b, gone], [], now);
    expect(blocks.map((x) => [x.key, x.startMin, x.endMin])).toEqual([["b1", 420, 480]]);
  });

  test("an unlimited session runs to the right edge on today, open-ended; a timed one to its end", () => {
    const sessions = [
      { placeId: 1, startedAt: at(2026, 11, 7, 14), endsAt: null, unlimited: true },
      { placeId: 2, startedAt: at(2026, 11, 7, 15), endsAt: at(2026, 11, 7, 17), unlimited: false },
    ];
    const [unlimited] = seatBlocks(1, day, w, [], sessions, now);
    const [timed] = seatBlocks(2, day, w, [], sessions, now);
    expect([unlimited.startMin, unlimited.endMin, unlimited.kind === "session" && unlimited.openEnded]).toEqual([360, 1080, true]);
    expect([timed.startMin, timed.endMin, timed.kind === "session" && timed.openEnded]).toEqual([420, 540, false]);
  });

  test("an unlimited session is not drawn on a later day, and is cut at the end of an earlier one", () => {
    const s = [{ placeId: 1, startedAt: at(2026, 11, 7, 23), endsAt: null, unlimited: true }];
    const nextDay = at(2026, 11, 8);
    const later = at(2026, 11, 8, 10);
    expect(seatBlocks(1, at(2026, 11, 9), timelineWindow(at(2026, 11, 9), [], [], later), [], s, later)).toEqual([]);
    const [cut] = seatBlocks(1, day, timelineWindow(day, [], s, later), [], s, later);
    expect([cut.intoNext, cut.kind === "session" && cut.openEnded]).toEqual([true, false]);
    expect(seatBlocks(1, nextDay, timelineWindow(nextDay, [], s, later), [], s, later)[0].kind).toBe("session");
  });

  test("overlapping bookings share the row in lanes; the session stays a full-row band behind them", () => {
    const blocks = seatBlocks(1, day, w, [res(1, at(2026, 11, 7, 16), 60), res(2, at(2026, 11, 7, 16, 30), 60)], [
      { placeId: 1, startedAt: at(2026, 11, 7, 15), endsAt: at(2026, 11, 7, 17), unlimited: false },
    ], now);
    expect(blocks.map((x) => [x.key, x.lane, x.lanes])).toEqual([["b1", 0, 2], ["b2", 1, 2], ["s1", 0, 1]]);
  });
});

describe("«Старт» is offered", () => {
  const now = at(2026, 11, 7, 15, 0);
  const none = new Set<number>();

  test("from two hours before the start until the end, on the first seat not running", () => {
    expect(startSeatOf(res(1, at(2026, 11, 7, 17, 0), 60), now, none)).toBe(1);
    expect(startSeatOf(res(1, at(2026, 11, 7, 17, 1), 60), now, none)).toBeNull();
    expect(startSeatOf(res(1, at(2026, 11, 7, 14, 30), 60), now, none)).toBe(1);
    expect(startSeatOf(res(1, at(2026, 11, 7, 14, 0), 60), now, none)).toBeNull();
    expect(startSeatOf(res(1, at(2026, 11, 7, 15, 30), 60, { place_ids: [1, 2] }), now, new Set([1]))).toBe(2);
  });

  test("only while it waits: pending or confirmed, nobody seated, its seat free", () => {
    const soon = at(2026, 11, 7, 15, 30);
    expect(startSeatOf(res(1, soon, 60, { status: "confirmed" }), now, none)).toBe(1);
    expect(startSeatOf(res(1, soon, 60, { status: "finished" }), now, none)).toBeNull();
    expect(startSeatOf(res(1, soon, 60, { status: "cancelled" }), now, none)).toBeNull();
    expect(startSeatOf(res(1, soon, 60, { session_id: 9 }), now, none)).toBeNull();
    expect(startSeatOf(res(1, soon, 60), now, new Set([1]))).toBeNull();
  });
});
