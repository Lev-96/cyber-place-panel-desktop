/**
 * The bookings calendar's arithmetic (2026-11-07, simplified the same day):
 * which days the date strip shows and what range it asks the server for,
 * the club day a timeline draws, where a block sits on it and which lane it
 * takes beside the blocks it overlaps, and when «Старт» is offered. Pure: no
 * React, no clock of its own; "now" is always passed in.
 *
 * Dates are LOCAL: the panel runs on venue machines in Asia/Yerevan, the
 * zone every booking's naive date and time is written in. Days are built
 * with `new Date(y, m, d, h)`, never by adding 24 h, so a day is always a
 * calendar day.
 *
 * A CLUB DAY runs from 06:00 to 06:00 the next morning: Saturday's night
 * (a booking 23:00–01:00, a session at 02:00) is Saturday's, as the desk
 * thinks of it. A booking is clipped to the club day it is drawn on.
 *
 * Nothing here decides availability. Overlaps are only laid out in lanes;
 * whether two bookings may share a seat, and whether a booking may start,
 * is the server's answer.
 */

import type { StaffReservation } from "@/domain/StaffReservation";

/** The hour a club day starts at (and the previous one ends at). */
export const DAY_START_HOUR = 6;
/** What a timeline shows when nothing on it reaches further: 08:00 to 02:00 the next night. */
export const DEFAULT_FROM_HOUR = 8;
export const DEFAULT_TO_HOUR = 26;
/** Days in the date strip: today and the next 13. */
export const STRIP_DAYS = 14;
/** The step a click on empty time rounds down to. */
export const SLOT_MINUTES = 15;
/** The step "now" is rounded up to for a new reservation's default start. */
export const DEFAULT_START_STEP = 5;
/** How early «Старт» is offered before a booking's start. */
export const START_LEAD_MINUTES = 120;

const MINUTE_MS = 60_000;
const pad = (n: number): string => String(n).padStart(2, "0");

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** `day` at `hour` (24 and above run into the next day). */
export const atHour = (day: Date, hour: number): Date => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);

/** "2026-11-07", the shape the server takes. */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "15:05", 24-hour. */
export const hm = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "07.11" */
export const dm = (d: Date): string => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;

/** Local midnight of a "Y-m-d"; null when it is not one. */
export const parseYmd = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
};

/** `getDay()` order (Sunday first), as the weekday dictionary keys are named. */
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** The club day `now` belongs to: before 06:00 it is still the previous one. */
export const clubDayOf = (now: Date): Date =>
  now.getHours() < DAY_START_HOUR ? addDays(startOfDay(now), -1) : startOfDay(now);

/** A club day's start and end: 06:00 to 06:00 the next morning. */
export const clubDayBounds = (day: Date): { start: Date; end: Date } => ({
  start: atHour(day, DAY_START_HOUR),
  end: atHour(day, DAY_START_HOUR + 24),
});

/** The strip's days, from `first`. */
export const stripDays = (first: Date): Date[] => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(first, i));

/**
 * The range asked of the server for a strip: its days, plus the day BEFORE
 * (a booking that started there and runs into the first club day) and the
 * day AFTER (the last club day's night is dated the next day). The server
 * filters by a booking's DAY, so both edges matter.
 */
export const fetchRange = (first: Date): { from: string; to: string } => ({
  from: ymd(addDays(first, -1)),
  to: ymd(addDays(first, STRIP_DAYS)),
});

/** Minutes from `a` to `b`. */
export const minutesBetween = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / MINUTE_MS;

/** `d` at the next multiple of `step` minutes (seconds dropped); already on one, it stays. */
export const roundUpToStep = (d: Date, step: number = DEFAULT_START_STEP): Date => {
  const exact = d.getSeconds() === 0 && d.getMilliseconds() === 0;
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  const m = base.getHours() * 60 + base.getMinutes();
  const up = m % step === 0 && exact ? m : (Math.floor(m / step) + 1) * step;
  return new Date(base.getTime() + (up - m) * MINUTE_MS);
};

const floorHour = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours());
const ceilHour = (d: Date): Date => {
  const f = floorHour(d);
  return f.getTime() === d.getTime() ? f : new Date(f.getTime() + 60 * MINUTE_MS);
};
const minDate = (a: Date, b: Date): Date => (a < b ? a : b);
const maxDate = (a: Date, b: Date): Date => (a > b ? a : b);

/** The part of `start`…`end` inside `from`…`to`; null when none is. */
export interface Clip {
  start: Date;
  end: Date;
  /** Began before `from` (drawn from the left edge, cut). */
  fromBefore: boolean;
  /** Runs on past `to` (drawn to the right edge, cut). */
  intoNext: boolean;
}

export const clip = (start: Date, end: Date, from: Date, to: Date): Clip | null => {
  const s = maxDate(start, from);
  const e = minDate(end, to);
  if (e <= s) return null;
  return { start: s, end: e, fromBefore: start < from, intoNext: end > to };
};

/** A running seat as the board knows it. */
export interface CalendarSession {
  placeId: number;
  startedAt: Date;
  /** Null for an open-ended (unlimited) session. */
  endsAt: Date | null;
  unlimited: boolean;
}

const isOpenEnded = (s: CalendarSession): boolean => s.unlimited || s.endsAt === null;

/** Cancelled bookings are not drawn or listed. */
export const isShown = (r: StaffReservation): boolean => r.status !== "cancelled";

/** The hours a timeline draws: whole hours, from `start` to `end`. */
export interface TimelineWindow {
  start: Date;
  end: Date;
  minutes: number;
}

/**
 * The hours a club day's timeline draws: 08:00 to 02:00, widened to whole
 * hours so no booking, no session and not "now" is cut off (never past the
 * club day itself).
 */
export const timelineWindow = (
  day: Date,
  reservations: readonly StaffReservation[],
  sessions: readonly CalendarSession[],
  now: Date,
): TimelineWindow => {
  const bounds = clubDayBounds(day);
  let lo = atHour(day, DEFAULT_FROM_HOUR);
  let hi = atHour(day, DEFAULT_TO_HOUR);
  const take = (start: Date, end: Date) => {
    const c = clip(start, end, bounds.start, bounds.end);
    if (!c) return;
    lo = minDate(lo, floorHour(c.start));
    hi = maxDate(hi, ceilHour(c.end));
  };
  for (const r of reservations) if (isShown(r)) take(r.start, r.end);
  for (const s of sessions) take(s.startedAt, isOpenEnded(s) ? maxDate(now, s.startedAt) : (s.endsAt as Date));
  take(now, new Date(now.getTime() + MINUTE_MS));
  return { start: lo, end: hi, minutes: minutesBetween(lo, hi) };
};

/** Lane `lane` of `lanes` stacked lanes. */
export interface Lane { lane: number; lanes: number }

/**
 * Overlapping blocks in lanes. Blocks that overlap (directly or through a
 * chain) form one group; each takes the first lane free at its start, and
 * every block of a group is as thin as the group's busiest moment needs.
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

/** Where a block sits on a timeline, in minutes from the window's start. */
export interface Placement {
  startMin: number;
  endMin: number;
  fromBefore: boolean;
  intoNext: boolean;
}

type BlockBody =
  | { key: string; kind: "booking"; reservation: StaffReservation }
  /** `openEnded`: unlimited and running now, drawn fading out to the right edge. */
  | { key: string; kind: "session"; session: CalendarSession; openEnded: boolean };

/** One block on a seat's row: a booking or a running session, placed and laned. */
export type TimelineBlock = Placement & Lane & BlockBody;

/**
 * One seat's blocks on a club day: its bookings (cancelled ones left out),
 * laned among themselves, and its running session as a band BEHIND them
 * (always the full row: an unlimited session overlaps every later booking of
 * its seat, and halving them all would only make them unreadable). A session
 * with no end runs to the window's right edge while the day being drawn is
 * the one "now" is in; on an earlier day it is cut at that day's end.
 */
export const seatBlocks = (
  placeId: number,
  day: Date,
  window: TimelineWindow,
  reservations: readonly StaffReservation[],
  sessions: readonly CalendarSession[],
  now: Date,
): TimelineBlock[] => {
  const bounds = clubDayBounds(day);
  const nowInDay = now >= bounds.start && now < bounds.end;
  const place = (c: Clip): Placement => ({
    startMin: minutesBetween(window.start, c.start),
    endMin: minutesBetween(window.start, c.end),
    fromBefore: c.fromBefore,
    intoNext: c.intoNext,
  });
  const raw: (Placement & BlockBody)[] = [];
  for (const r of reservations) {
    if (!isShown(r) || !r.place_ids.includes(placeId)) continue;
    const c = clip(r.start, r.end, bounds.start, bounds.end);
    if (c) raw.push({ ...place(c), key: `b${r.id}`, kind: "booking", reservation: r });
  }
  for (const s of sessions) {
    if (s.placeId !== placeId) continue;
    const open = isOpenEnded(s);
    const end = open ? (nowInDay ? window.end : now) : (s.endsAt as Date);
    const c = clip(s.startedAt, end, bounds.start, bounds.end);
    if (c) raw.push({ ...place(c), key: `s${s.placeId}`, kind: "session", session: s, openEnded: open && nowInDay });
  }
  const lanes = assignLanes(raw.filter((b) => b.kind === "booking"));
  return raw.map((b) => ({ ...b, ...(lanes.get(b.key) ?? { lane: 0, lanes: 1 }) }));
};

/** The minute a click on a row lands on (`fraction` of the row's width), rounded DOWN to 15 minutes. */
export const slotAt = (window: TimelineWindow, fraction: number): Date => {
  const raw = Math.max(0, Math.min(1, fraction)) * window.minutes;
  const minute = Math.min(window.minutes - SLOT_MINUTES, Math.floor(raw / SLOT_MINUTES) * SLOT_MINUTES);
  return new Date(window.start.getTime() + Math.max(0, minute) * MINUTE_MS);
};

/** A club day's bookings in start order (a night booking on the day it starts in). */
export const dayBookings = (day: Date, reservations: readonly StaffReservation[]): StaffReservation[] => {
  const { start, end } = clubDayBounds(day);
  return reservations
    .filter((r) => isShown(r) && clip(r.start, r.end, start, end) !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.id - b.id);
};

/** How many bookings each strip day has, by `ymd`. */
export const bookingCounts = (days: readonly Date[], reservations: readonly StaffReservation[]): Map<string, number> =>
  new Map(days.map((d) => [ymd(d), dayBookings(d, reservations).length]));

const STARTABLE: ReadonlySet<StaffReservation["status"]> = new Set(["pending", "confirmed"]);

/**
 * The seat «Старт» would start this booking on, or null when it is not
 * offered: the booking is still waiting (pending / confirmed, nobody seated
 * on it), it starts within two hours or has begun and is not over, and one
 * of its seats is not running a session. Only a hint for the button: the
 * Start dialog and the server decide.
 */
export const startSeatOf = (r: StaffReservation, now: Date, running: ReadonlySet<number>): number | null => {
  if (!STARTABLE.has(r.status) || r.session_id !== null) return null;
  if (minutesBetween(now, r.start) > START_LEAD_MINUTES || now >= r.end) return null;
  return r.place_ids.find((id) => !running.has(id)) ?? null;
};
