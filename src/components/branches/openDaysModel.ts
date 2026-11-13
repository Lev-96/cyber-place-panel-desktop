import { fmt } from "@/i18n/translations";
import { HHMM_RE, minutesOfDay, toHHMM } from "@/utils/clockTime";

/**
 * The working-hours form's model, kept free of React so every rule is tested
 * on its own (`openDaysModel.test.ts`).
 *
 * The backend's rules this mirrors (`Branches\UpdateRequest`,
 * `Booking\WorkingWindow`):
 *  - `days_of_weeks` is 1..7 rows `{ day_of_week 1..7 (ISO, Mon = 1),
 *    start_time "HH:MM", end_time "HH:MM" }`; an empty list is refused, and a
 *    day with no row is a day off.
 *  - A close at or before the open lands on the NEXT calendar day: 10:00–02:40
 *    is open past midnight, 10:00–00:00 closes at midnight, and an equal pair
 *    is a 24-hour window (00:00–00:00 = the whole day, around the clock).
 */

type Translate = (key: string) => string;

export const WEEKDAYS: ReadonlyArray<{ iso: number; key: string }> = [
  { iso: 1, key: "branch.weekday.mon" },
  { iso: 2, key: "branch.weekday.tue" },
  { iso: 3, key: "branch.weekday.wed" },
  { iso: 4, key: "branch.weekday.thu" },
  { iso: 5, key: "branch.weekday.fri" },
  { iso: 6, key: "branch.weekday.sat" },
  { iso: 7, key: "branch.weekday.sun" },
];

export const DEFAULT_OPEN = "10:00";
export const DEFAULT_CLOSE = "23:00";
const MIDNIGHT = "00:00";
const DAY_MINUTES = 24 * 60;

export interface OpenDay {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** One weekday in the form. A closed day keeps its times, so turning it back on restores them. */
export interface DayRow extends OpenDay {
  open: boolean;
}

/** The weekday's short name ("Mon" / "Пн" / "Երկ"). */
export const dayLabel = (iso: number, t: Translate): string => {
  const day = WEEKDAYS.find((d) => d.iso === iso);
  return day ? t(day.key) : String(iso);
};

/** Mon..Sun from the branch's stored rows, every time trimmed to "HH:MM" or replaced by the default. */
export const rowsFromBranch = (stored: ReadonlyArray<OpenDay> | null | undefined): DayRow[] =>
  WEEKDAYS.map(({ iso }) => {
    const row = stored?.find((d) => Number(d.day_of_week) === iso);
    return {
      day_of_week: iso,
      open: row !== undefined,
      start_time: toHHMM(row?.start_time) ?? DEFAULT_OPEN,
      end_time: toHHMM(row?.end_time) ?? DEFAULT_CLOSE,
    };
  });

export const hasValidTimes = (row: OpenDay): boolean =>
  HHMM_RE.test(row.start_time) && HHMM_RE.test(row.end_time);

/** Exactly what the backend takes: the open days, Mon..Sun, "HH:MM" only. */
export const payloadOf = (rows: ReadonlyArray<DayRow>): OpenDay[] =>
  rows
    .filter((r) => r.open)
    .map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }));

/**
 * What a row's pair of times means (WorkingWindow::forRow):
 *  - `sameDay`     closes later the same day (10:00–23:00);
 *  - `toMidnight`  closes at midnight (10:00–00:00);
 *  - `overnight`   closes after midnight, `end < start` (10:00–02:40);
 *  - `fullDay`     equal times: 24 hours from the open (10:00–10:00);
 *  - `allDay`      00:00–00:00, the whole calendar day;
 *  - `invalid`     a time is not a complete "HH:MM" yet.
 */
export type SpanKind = "sameDay" | "toMidnight" | "overnight" | "fullDay" | "allDay" | "invalid";

export const spanOf = (row: OpenDay): SpanKind => {
  if (!hasValidTimes(row)) return "invalid";
  const start = minutesOfDay(row.start_time);
  const end = minutesOfDay(row.end_time);
  if (start === end) return row.start_time === MIDNIGHT ? "allDay" : "fullDay";
  if (row.end_time === MIDNIGHT) return "toMidnight";
  return end < start ? "overnight" : "sameDay";
};

/** True when the day's window continues into the next calendar day. */
export const runsPastMidnight = (kind: SpanKind): boolean => kind === "overnight" || kind === "fullDay";

/**
 * The open band on this day's 24-hour track, in minutes [from, to), or null
 * when there is nothing to draw. The part after midnight belongs to the next
 * calendar day and is not drawn here: `runsPastMidnight` marks it instead.
 */
export const bandOf = (row: OpenDay): { from: number; to: number } | null => {
  const kind = spanOf(row);
  if (kind === "invalid") return null;
  if (kind === "allDay") return { from: 0, to: DAY_MINUTES };
  const from = minutesOfDay(row.start_time);
  return { from, to: kind === "sameDay" ? minutesOfDay(row.end_time) : DAY_MINUTES };
};

/** The row's hint, or null when the two times already say everything. */
export const hintOf = (row: OpenDay, t: Translate): string | null => {
  switch (spanOf(row)) {
    case "overnight": return fmt(t("openDays.hint.overnight"), row.end_time);
    case "fullDay": return fmt(t("openDays.hint.fullDay"), row.end_time);
    case "allDay": return t("openDays.hint.allDay");
    default: return null;
  }
};

const rangeOf = (row: OpenDay, t: Translate): string => {
  const kind = spanOf(row);
  if (kind === "allDay") return t("openDays.range.allDay");
  if (runsPastMidnight(kind)) return fmt(t("openDays.range.overnight"), row.start_time, row.end_time);
  return `${row.start_time}–${row.end_time}`;
};

/** The one line over the rows: «Открыто 5 из 7 дней · 10:00–23:00». */
export const summaryOf = (rows: ReadonlyArray<DayRow>, t: Translate): string => {
  const open = rows.filter((r) => r.open);
  if (open.length === 0) return t("openDays.summary.closed");
  const sameHours = open.every((r) => r.start_time === open[0].start_time && r.end_time === open[0].end_time);
  const hours = sameHours && hasValidTimes(open[0]) ? rangeOf(open[0], t) : t("openDays.summary.mixed");
  if (open.length === rows.length) {
    return sameHours && spanOf(open[0]) === "allDay"
      ? t("openDays.summary.always")
      : fmt(t("openDays.summary.everyDay"), hours);
  }
  return fmt(t("openDays.summary.someDays"), open.length, hours);
};

/** «Применить ко всем дням»: this row's hours on every OPEN day; closed days stay closed. */
export const applyToOpenDays = (rows: ReadonlyArray<DayRow>, from: number): DayRow[] => {
  const source = rows.find((r) => r.day_of_week === from);
  if (!source) return [...rows];
  return rows.map((r) => (r.open ? { ...r, start_time: source.start_time, end_time: source.end_time } : r));
};

/** A time field the server refused: `${day_of_week}:start` / `${day_of_week}:end`. */
export type FieldRef = `${number}:${"start" | "end"}`;

const SERVER_FIELD = /^days_of_weeks\.(\d+)\.(start_time|end_time)$/;
// The attribute as Laravel prints it in a sentence: raw, or with the
// underscores turned into spaces when no display name is configured.
const SERVER_ATTRIBUTE = /days[_ ]of[_ ]weeks(?:\.(\d+)\.(start[_ ]time|end[_ ]time|day[_ ]of[_ ]week))?/g;

interface ServerError {
  status?: unknown;
  body?: { message?: unknown; errors?: unknown } | null;
}

/** Which time fields a 422 named, mapped from the payload index back to the weekday. */
export const refusedFields = (e: unknown, sent: ReadonlyArray<OpenDay>): Set<FieldRef> => {
  const out = new Set<FieldRef>();
  const errors = (e as ServerError | null)?.body?.errors;
  if (!errors || typeof errors !== "object") return out;
  for (const key of Object.keys(errors)) {
    const m = SERVER_FIELD.exec(key);
    const day = m ? sent[Number(m[1])]?.day_of_week : undefined;
    if (m && day !== undefined) out.add(`${day}:${m[2] === "start_time" ? "start" : "end"}`);
  }
  return out;
};

/**
 * The server's own sentence (the API client's message, already in the
 * panel's language), with its field paths named the way the form shows them:
 * "days_of_weeks.0.start_time" → «Пн, Открытие». Null when there is no server
 * sentence to show (offline, a bare 5xx): the caller shows its generic one.
 */
export const readableSaveError = (e: unknown, sent: ReadonlyArray<OpenDay>, t: Translate): string | null => {
  const err = e as ServerError | null;
  const message = err?.body?.message;
  if (!(e instanceof Error) || typeof err?.status !== "number" || typeof message !== "string" || !message.trim()) {
    return null;
  }
  return e.message.replace(SERVER_ATTRIBUTE, (_all, index?: string, field?: string) => {
    if (index === undefined || field === undefined) return fmt(t("openDays.errorField"), t("branch.editTabs.hours"));
    const iso = sent[Number(index)]?.day_of_week;
    if (iso === undefined) return fmt(t("openDays.errorField"), t("branch.editTabs.hours"));
    const day = dayLabel(iso, t);
    if (field.startsWith("day")) return fmt(t("openDays.errorField"), day);
    const what = t(field.startsWith("start") ? "branch.openTime" : "branch.closeTime");
    return fmt(t("openDays.errorField"), fmt(t("openDays.timeField"), day, what));
  });
};
