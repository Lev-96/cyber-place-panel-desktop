/**
 * The bookings calendar's arithmetic (2026-11-07): which days a view shows,
 * what range it asks the server for, where a block sits on a day and which
 * lane it takes beside the blocks it overlaps. Pure: no React, no clock of
 * its own — "now" is always passed in.
 *
 * Dates are LOCAL: the panel runs on venue machines in Asia/Yerevan, the
 * zone every booking's naive date and time is written in. Days are built
 * with `new Date(y, m, d)`, never by adding 24 h, so a day is always a
 * calendar day.
 *
 * Nothing here decides availability. Overlaps are only laid out side by
 * side; whether two bookings may share a seat is the server's answer.
 */

import type { StaffReservation } from "@/domain/StaffReservation";

export type CalendarView = "day" | "week" | "month";

export const MINUTES_PER_DAY = 24 * 60;
/** The grid's step and the step a click on an empty slot rounds down to. */
export const SLOT_MINUTES = 15;
/** The step "now" is rounded up to for a new reservation's default start. */
export const DEFAULT_START_STEP = 5;
/** The server's range ceiling (`ReservationCalendarRequest::MAX_DAYS`); a month grid is at most 42. */
export const MAX_RANGE_DAYS = 62;

const MINUTE_MS = 60_000;
const pad = (n: number): string => String(n).padStart(2, "0");

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "2026-11-07", the shape the server takes. */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "15:05", 24-hour. */
export const hm = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Local midnight of a "Y-m-d"; null when it is not one. */
export const parseYmd = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
};

/** The Monday of `d`'s week (weeks start on Monday here). */
export const startOfWeek = (d: Date): Date => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

/** Every day a view draws: one, a Monday-to-Sunday week, or the whole weeks covering a month. */
export const visibleDays = (view: CalendarView, anchor: Date): Date[] => {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") {
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const from = startOfWeek(first);
  const to = addDays(startOfWeek(last), 6);
  const days: Date[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
};

/**
 * The range asked of the server: the first and last visible day, plus the day
 * BEFORE, so a booking that started there and runs past midnight is drawn on
 * the first visible day too.
 */
export const fetchRange = (view: CalendarView, anchor: Date): { from: string; to: string } => {
  const days = visibleDays(view, anchor);
  return { from: ymd(addDays(days[0], -1)), to: ymd(days[days.length - 1]) };
};

/** The anchor one view's step earlier or later: a day, a week, or a month (on its 1st). */
export const shiftAnchor = (view: CalendarView, anchor: Date, dir: 1 | -1): Date => {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, 7 * dir);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
};

/** Minutes since local midnight. */
export const minuteOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();

/** `d` at the next multiple of `step` minutes (seconds dropped); already on one, it stays. */
export const roundUpToStep = (d: Date, step: number = DEFAULT_START_STEP): Date => {
  const exact = d.getSeconds() === 0 && d.getMilliseconds() === 0;
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  const m = minuteOfDay(base);
  const up = m % step === 0 && exact ? m : (Math.floor(m / step) + 1) * step;
  return new Date(base.getTime() + (up - m) * MINUTE_MS);
};

/** A minute of the day rounded DOWN to the grid's slot: a click in 10:00…10:14 is 10:00. */
export const slotOf = (minute: number, step: number = SLOT_MINUTES): number =>
  Math.max(0, Math.min(MINUTES_PER_DAY - step, Math.floor(minute / step) * step));

/** The part of `start`…`end` that falls on `day`, in minutes of that day; null when none does. */
export interface DaySpan {
  startMin: number;
  endMin: number;
  /** Began on an earlier day (drawn from midnight). */
  fromBefore: boolean;
  /** Runs on past midnight (drawn to the day's end). */
  intoNext: boolean;
}

export const clipToDay = (start: Date, end: Date, day: Date): DaySpan | null => {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const s = Math.max(start.getTime(), dayStart);
  const e = Math.min(end.getTime(), dayEnd);
  if (e <= s) return null;
  return {
    startMin: (s - dayStart) / MINUTE_MS,
    endMin: (e - dayStart) / MINUTE_MS,
    fromBefore: start.getTime() < dayStart,
    intoNext: end.getTime() > dayEnd,
  };
};

/** Lane `lane` of `lanes` side-by-side lanes. */
export interface Lane { lane: number; lanes: number }

/**
 * Overlapping blocks side by side. Blocks that overlap (directly or through a
 * chain) form one group; each takes the first lane free at its start, and
 * every block of a group is as narrow as the group's widest moment needs.
 * Blocks that only touch (one ends at 15:00, the next starts at 15:00) do not
 * overlap.
 */
export const assignLanes = <K>(items: readonly { key: K; startMin: number; endMin: number }[]): Map<K, Lane> => {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = new Map<K, Lane>();
  let group: { key: K; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const close = () => {
    for (const g of group) out.set(g.key, { lane: g.lane, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  };

  for (const it of sorted) {
    if (it.startMin >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.endMin);
    } else {
      laneEnds[lane] = it.endMin;
    }
    group.push({ key: it.key, lane });
    groupEnd = Math.max(groupEnd, it.endMin);
  }
  close();
  return out;
};

/** A running seat as the board knows it. */
export interface CalendarSession {
  placeId: number;
  startedAt: Date;
  /** Null for an open-ended (unlimited) session. */
  endsAt: Date | null;
  unlimited: boolean;
}

type BlockBody =
  | { key: string; kind: "booking"; reservation: StaffReservation }
  | { key: string; kind: "session"; session: CalendarSession; openEnded: boolean };

/** One block on a day: a booking or a running session, placed and laned. */
export type CalendarBlock = DaySpan & Lane & BlockBody;

const isShown = (r: StaffReservation): boolean => r.status !== "cancelled";

/**
 * The blocks of one day: the bookings (cancelled ones left out) and the
 * running sessions, optionally of one seat only, laned together.
 *
 * A session with no end (unlimited, or one the board knows no end for) runs
 * to `now` and grows as time passes.
 */
export const dayBlocks = (
  day: Date,
  reservations: readonly StaffReservation[],
  sessions: readonly CalendarSession[],
  now: Date,
  placeId: number | null,
): CalendarBlock[] => {
  const raw: (DaySpan & BlockBody)[] = [];
  for (const r of reservations) {
    if (!isShown(r) || (placeId !== null && !r.place_ids.includes(placeId))) continue;
    const span = clipToDay(r.start, r.end, day);
    if (span) raw.push({ ...span, key: `b${r.id}`, kind: "booking", reservation: r });
  }
  for (const s of sessions) {
    if (placeId !== null && s.placeId !== placeId) continue;
    const end = !s.unlimited && s.endsAt ? s.endsAt : now;
    const span = clipToDay(s.startedAt, end, day);
    const openEnded = end === now;
    if (span) raw.push({ ...span, key: `s${s.placeId}`, kind: "session", session: s, openEnded });
  }
  const lanes = assignLanes(raw);
  return raw.map((b) => ({ ...b, ...(lanes.get(b.key) ?? { lane: 0, lanes: 1 }) }));
};

/** The bookings touching each day (a midnight-crossing one on both), in start order: the month grid's chips. */
export const bookingsByDay = (days: readonly Date[], reservations: readonly StaffReservation[]): Map<string, StaffReservation[]> => {
  const out = new Map<string, StaffReservation[]>();
  const ordered = reservations.filter(isShown).sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const day of days) {
    out.set(ymd(day), ordered.filter((r) => clipToDay(r.start, r.end, day) !== null));
  }
  return out;
};

/** `getDay()` order (Sunday first), as the weekday dictionary keys are named. */
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** "Sat, 07.11.2026" / "02.11 – 08.11.2026" / "November 2026", built from translated pieces. */
export const rangeTitle = (view: CalendarView, anchor: Date, t: (key: string) => string): string => {
  const dm = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  const dmy = (d: Date) => `${dm(d)}.${d.getFullYear()}`;
  if (view === "day") return `${t(`branch.weekday.${WEEKDAY_KEYS[anchor.getDay()]}`)}, ${dmy(anchor)}`;
  if (view === "week") {
    const days = visibleDays("week", anchor);
    const first = days[0];
    const last = days[6];
    return first.getFullYear() === last.getFullYear() ? `${dm(first)} – ${dmy(last)}` : `${dmy(first)} – ${dmy(last)}`;
  }
  return `${t(`calendar.month.${anchor.getMonth() + 1}`)} ${anchor.getFullYear()}`;
};
