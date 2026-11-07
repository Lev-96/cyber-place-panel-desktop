import { describe, expect, test } from "vitest";
import type { StaffReservation } from "@/domain/StaffReservation";
import {
  addDays, assignLanes, bookingsByDay, clipToDay, dayBlocks, fetchRange, isSameDay, parseYmd, rangeTitle,
  roundUpToStep, shiftAnchor, slotOf, startOfWeek, visibleDays, ymd,
} from "./calendarModel";

/** The bookings calendar's arithmetic (2026-11-07): ranges, midnight, lanes, positions. */

const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s);

const res = (id: number, start: Date, minutes: number, extra: Partial<StaffReservation> = {}): StaffReservation => ({
  id, status: "pending", booking_date: ymd(start), start_time: "00:00", duration_minutes: minutes,
  starts_at: start.toISOString(), ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
  place_ids: [1], contact_name: null, contact_phone: null, guest_name: null, source: "staff", session_id: null,
  editable: true, start, end: new Date(start.getTime() + minutes * 60_000), ...extra,
});

describe("days and ranges", () => {
  test("a week starts on Monday, also from a Sunday", () => {
    expect(ymd(startOfWeek(at(2026, 11, 7)))).toBe("2026-11-02"); // Saturday
    expect(ymd(startOfWeek(at(2026, 11, 8)))).toBe("2026-11-02"); // Sunday
    expect(ymd(startOfWeek(at(2026, 11, 2)))).toBe("2026-11-02"); // Monday itself
  });

  test("day, week and month views draw one day, Monday to Sunday, and whole weeks around the month", () => {
    expect(visibleDays("day", at(2026, 11, 7, 15)).map(ymd)).toEqual(["2026-11-07"]);
    const week = visibleDays("week", at(2026, 11, 7));
    expect(week.map(ymd)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    const month = visibleDays("month", at(2026, 11, 7));
    expect(ymd(month[0])).toBe("2026-10-26");
    expect(ymd(month[month.length - 1])).toBe("2026-12-06");
    expect(month.length % 7).toBe(0);
  });

  test("the range asked for starts a day early, for a booking that crosses into the first day", () => {
    expect(fetchRange("day", at(2026, 11, 7))).toEqual({ from: "2026-11-06", to: "2026-11-07" });
    expect(fetchRange("week", at(2026, 11, 7))).toEqual({ from: "2026-11-01", to: "2026-11-08" });
    expect(fetchRange("month", at(2026, 11, 7))).toEqual({ from: "2026-10-25", to: "2026-12-06" });
  });

  test("every view's range stays inside the server's 62 days", () => {
    for (let m = 1; m <= 12; m += 1) {
      const { from, to } = fetchRange("month", at(2026, m, 15));
      const days = Math.round(((parseYmd(to) as Date).getTime() - (parseYmd(from) as Date).getTime()) / 86_400_000) + 1;
      expect(days).toBeLessThanOrEqual(62);
    }
  });

  test("‹ and › step a day, a week, or a month (to its 1st, so 31 January → February)", () => {
    expect(ymd(shiftAnchor("day", at(2026, 12, 31), 1))).toBe("2027-01-01");
    expect(ymd(shiftAnchor("week", at(2026, 11, 7), -1))).toBe("2026-10-31");
    expect(ymd(shiftAnchor("month", at(2026, 1, 31), 1))).toBe("2026-02-01");
    expect(ymd(shiftAnchor("month", at(2026, 1, 15), -1))).toBe("2025-12-01");
  });

  test("Y-m-d round trip; an impossible date is no date", () => {
    expect(ymd(parseYmd("2026-02-28") as Date)).toBe("2026-02-28");
    expect(parseYmd("2026-02-30")).toBeNull();
    expect(parseYmd("07.11.2026")).toBeNull();
    expect(isSameDay(addDays(at(2026, 11, 7, 23), 0), at(2026, 11, 7))).toBe(true);
  });
});

describe("time", () => {
  test("now rounds UP to the next 5 minutes; a whole 5 stays", () => {
    expect(roundUpToStep(at(2026, 11, 7, 15, 2)).getMinutes()).toBe(5);
    expect(roundUpToStep(at(2026, 11, 7, 15, 5)).getMinutes()).toBe(5);
    expect(roundUpToStep(at(2026, 11, 7, 15, 5, 30)).getMinutes()).toBe(10);
    const late = roundUpToStep(at(2026, 11, 7, 23, 58));
    expect([ymd(late), late.getHours(), late.getMinutes()]).toEqual(["2026-11-08", 0, 0]);
  });

  test("a click rounds DOWN to its 15-minute slot, never past the last one", () => {
    expect(slotOf(607)).toBe(600);
    expect(slotOf(614.9)).toBe(600);
    expect(slotOf(615)).toBe(615);
    expect(slotOf(1439)).toBe(1425);
    expect(slotOf(-3)).toBe(0);
  });
});

describe("midnight", () => {
  test("a booking 23:00 to 01:00 is drawn on both days, clipped at midnight", () => {
    const start = at(2026, 11, 7, 23);
    const end = at(2026, 11, 8, 1);
    expect(clipToDay(start, end, at(2026, 11, 7))).toEqual({ startMin: 1380, endMin: 1440, fromBefore: false, intoNext: true });
    expect(clipToDay(start, end, at(2026, 11, 8))).toEqual({ startMin: 0, endMin: 60, fromBefore: true, intoNext: false });
    expect(clipToDay(start, end, at(2026, 11, 9))).toBeNull();
    expect(clipToDay(start, end, at(2026, 11, 6))).toBeNull();
  });

  test("a booking that ends exactly at midnight is not on the next day", () => {
    expect(clipToDay(at(2026, 11, 7, 22), at(2026, 11, 8), at(2026, 11, 8))).toBeNull();
  });

  test("the month grid lists a midnight-crossing booking on both days, in start order", () => {
    const late = res(1, at(2026, 11, 7, 23), 120);
    const early = res(2, at(2026, 11, 7, 10), 60);
    const map = bookingsByDay([at(2026, 11, 7), at(2026, 11, 8)], [late, early]);
    expect((map.get("2026-11-07") ?? []).map((r) => r.id)).toEqual([2, 1]);
    expect((map.get("2026-11-08") ?? []).map((r) => r.id)).toEqual([1]);
  });
});

describe("lanes", () => {
  test("blocks that do not overlap all take the full width", () => {
    const lanes = assignLanes([{ key: "a", startMin: 0, endMin: 60 }, { key: "b", startMin: 60, endMin: 120 }]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get("b")).toEqual({ lane: 0, lanes: 1 });
  });

  test("two overlapping blocks sit side by side; a third after both reuses lane 0 of a new group", () => {
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

  test("three at once need three lanes", () => {
    const lanes = assignLanes([
      { key: 1, startMin: 0, endMin: 60 }, { key: 2, startMin: 10, endMin: 60 }, { key: 3, startMin: 20, endMin: 60 },
    ]);
    expect([lanes.get(1)?.lane, lanes.get(2)?.lane, lanes.get(3)?.lane]).toEqual([0, 1, 2]);
    expect(lanes.get(3)?.lanes).toBe(3);
  });
});

describe("a day's blocks", () => {
  const day = at(2026, 11, 7);
  const now = at(2026, 11, 7, 16, 30);

  test("bookings by minute, cancelled left out, one seat's only when filtered", () => {
    const a = res(1, at(2026, 11, 7, 15), 60, { place_ids: [1] });
    const b = res(2, at(2026, 11, 7, 18), 90, { place_ids: [2] });
    const gone = res(3, at(2026, 11, 7, 12), 60, { status: "cancelled" });
    const all = dayBlocks(day, [a, b, gone], [], now, null);
    expect(all.map((x) => [x.key, x.startMin, x.endMin])).toEqual([["b1", 900, 960], ["b2", 1080, 1170]]);
    expect(dayBlocks(day, [a, b], [], now, 2).map((x) => x.key)).toEqual(["b2"]);
  });

  test("an unlimited session runs from its start to now and is open-ended; a timed one to its end", () => {
    const blocks = dayBlocks(day, [], [
      { placeId: 1, startedAt: at(2026, 11, 7, 14), endsAt: null, unlimited: true },
      { placeId: 2, startedAt: at(2026, 11, 7, 15), endsAt: at(2026, 11, 7, 17), unlimited: false },
    ], now, null);
    const unlimited = blocks.find((x) => x.key === "s1");
    const timed = blocks.find((x) => x.key === "s2");
    expect([unlimited?.startMin, unlimited?.endMin, unlimited?.kind === "session" && unlimited.openEnded]).toEqual([840, 990, true]);
    expect([timed?.startMin, timed?.endMin, timed?.kind === "session" && timed.openEnded]).toEqual([900, 1020, false]);
  });

  test("a session and a booking overlapping on one seat share it in two lanes", () => {
    const blocks = dayBlocks(day, [res(1, at(2026, 11, 7, 16), 60)], [
      { placeId: 1, startedAt: at(2026, 11, 7, 15), endsAt: at(2026, 11, 7, 17), unlimited: false },
    ], now, 1);
    expect(blocks.every((x) => x.lanes === 2)).toBe(true);
  });
});

describe("the title", () => {
  const t = (k: string) => k;
  test("names the day, the week's span and the month", () => {
    expect(rangeTitle("day", at(2026, 11, 7), t)).toBe("branch.weekday.sat, 07.11.2026");
    expect(rangeTitle("week", at(2026, 11, 7), t)).toBe("02.11 – 08.11.2026");
    expect(rangeTitle("week", at(2026, 12, 31), t)).toBe("28.12.2026 – 03.01.2027");
    expect(rangeTitle("month", at(2026, 11, 7), t)).toBe("calendar.month.11 2026");
  });
});
