/**
 * A length of time typed or picked in hours OR minutes, and read as minutes.
 *
 * One model for "+ Время" and for a planned start (2026-10-25), so the two
 * forms cannot disagree about what "1.5" means. The value is ONE string plus
 * ONE unit: there is never a minutes box and an hours box that could both be
 * filled, which is how the same number gets read twice.
 *
 * Nothing here prices anything — the price is the server's (`time-quote`,
 * `start-quote`).
 */
export type DurationUnit = "hours" | "minutes";

/** The server's ceiling for one grant or plan (`SessionTimeService::MAX_MINUTES`). */
export const MAX_DURATION_MINUTES = 600;

export const HOUR_PRESETS = [1, 2, 3, 4, 5] as const;
export const MINUTE_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120, 180] as const;

export const presetsOf = (unit: DurationUnit): readonly number[] =>
  unit === "hours" ? HOUR_PRESETS : MINUTE_PRESETS;

/**
 * The minutes a typed amount means, or null when it means none the server
 * would accept: empty, not a number, not a whole number of minutes, or
 * outside 1…600 (or 1…`maxMinutes`, for a caller with another ceiling).
 * "1,5" is accepted as 1.5 — a decimal comma is how half the floor types it.
 */
export const minutesOf = (
  amount: string,
  unit: DurationUnit,
  maxMinutes: number = MAX_DURATION_MINUTES,
): number | null => {
  const raw = amount.trim().replace(",", ".");
  if (raw === "") return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  const minutes = unit === "hours" ? value * 60 : value;
  // 0.1 h is 6 min; 0.33 h is not a whole minute and is refused rather than
  // rounded behind the cashier's back.
  const whole = Math.round(minutes);
  if (Math.abs(minutes - whole) > 1e-9) return null;

  return whole >= 1 && whole <= maxMinutes ? whole : null;
};

/**
 * A clock time "until" which a seat is started (2026-10-26), as the server
 * takes it — "HH:mm", 24-hour — or null when the box means no such time:
 * empty, "25:80", "24:00". "0:40" and "00.40" are read as 00:40, the way they
 * are typed at a counter. Only the shape is checked here: whether the time has
 * passed, and how long it is from now, is the server's answer on its own
 * clock (`start-quote`), never this machine's.
 */
export const clockOf = (text: string): string | null => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${m[2]}`;
};

/**
 * The same length written in the other unit, so switching hours ↔ minutes
 * keeps what was chosen instead of re-reading "2" as two minutes. A value
 * that means nothing yet is kept as typed.
 */
export const amountIn = (
  amount: string,
  from: DurationUnit,
  to: DurationUnit,
  maxMinutes: number = MAX_DURATION_MINUTES,
): string => {
  if (from === to) return amount;
  const minutes = minutesOf(amount, from, maxMinutes);
  if (minutes === null) return amount;
  if (to === "minutes") return String(minutes);

  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
};

/*
 * A length written the way it is said at a counter (2026-11-05, owner: one
 * box, no hours/minutes switch, no presets): "1ч", "30мин", "1ч 30мин",
 * "1h30", "1:30", "1,5ч" — in Russian, English or Armenian units.
 */
const HOUR_UNIT = "(?:часов|часа|час|ч|hours|hour|hrs|hr|h|ժամ|ժ)";
const MINUTE_UNIT = "(?:минуты|минута|минут|мин|м|minutes|minute|mins|min|m|րոպե|ր)";
const SPOKEN = new RegExp(
  `^(?:(\\d+(?:\\.\\d+)?)\\s*${HOUR_UNIT}\\.?)?\\s*(?:(\\d+)\\s*(${MINUTE_UNIT})?\\.?)?$`,
  "u",
);

/**
 * The minutes a length typed in one box means, or null when it means none
 * the server would take (the same rules as `minutesOf`: a whole number of
 * minutes, 1…`maxMinutes`).
 *
 *  - "1ч", "1.5 h", "2 ժ"        → hours;
 *  - "30мин", "45 m", "20 ր"     → minutes;
 *  - "1ч 30мин", "1h30", "1ч30м" → both;
 *  - "1:30", "1 30"              → hours, minutes;
 *  - a bare number               → hours while it could be a number of hours
 *    ("2", "1.5": up to the ceiling, 10 h), minutes past that ("30", "90"):
 *    no seat is planned for 30 hours. The box always shows how it read the
 *    value, so a bare number is never a silent guess.
 */
export const parseDuration = (text: string, maxMinutes: number = MAX_DURATION_MINUTES): number | null => {
  const raw = text.trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");
  if (raw === "") return null;

  // "1:30" and "1 30" (hours then minutes, as said: "one thirty").
  const clock = /^(\d{1,2})[: ](\d{2})$/.exec(raw) ?? /^(\d{1,2}) (\d)$/.exec(raw);
  if (clock) {
    const m = Number(clock[2]);
    return m < 60 ? minutesOf(String(Number(clock[1]) * 60 + m), "minutes", maxMinutes) : null;
  }

  // "1.30" is 1 h 30 min, as "1:30" is and as the clock field reads "14.30"
  // (two digits after the point, under 60). One digit is a decimal: "1.5".
  // "1.60" is refused rather than re-read as a decimal (1.6 h): a reading that
  // jumps between two rules is a length nobody typed.
  const hmm = /^(\d{1,2})\.(\d{2})$/.exec(raw);
  if (hmm) return Number(hmm[2]) < 60 ? minutesOf(String(Number(hmm[1]) * 60 + Number(hmm[2])), "minutes", maxMinutes) : null;

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    const minutesMeant = Number.isInteger(n) && n > maxMinutes / 60;
    return minutesOf(raw, minutesMeant ? "minutes" : "hours", maxMinutes);
  }

  const m = SPOKEN.exec(raw);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  // A number with no unit after a number of hours is its minutes ("1ч 30");
  // on its own it was handled above.
  if (m[1] === undefined && m[3] === undefined) return null;
  const hours = m[1] === undefined ? 0 : Number(m[1]) * 60;
  const total = hours + (m[2] === undefined ? 0 : Number(m[2]));
  if (Math.abs(total - Math.round(total)) > 1e-9) return null;
  return minutesOf(String(Math.round(total)), "minutes", maxMinutes);
};

/*
 * The length as a time-style field holds it (2026-11-05, owner): an hours box
 * and a minutes box, "[ 1 ] ч : [ 30 ] мин". Each box is plain text, read
 * here, so typing, pasting "1ч 30мин" or "1 30" all land the same way.
 */
export interface TwoBoxDraft {
  hours: string;
  minutes: string;
}
/** A length: hours and minutes of it. */
export type DurationDraft = TwoBoxDraft;
/** A clock time: the hour of the day and its minutes. */
export type ClockDraft = TwoBoxDraft;
export const EMPTY_DRAFT: TwoBoxDraft = { hours: "", minutes: "" };

export const isDraftEmpty = (d: TwoBoxDraft): boolean => d.hours.trim() === "" && d.minutes.trim() === "";

/** The boxes for a number of minutes: hours as is, minutes in two digits. */
export const draftOf = (minutes: number): DurationDraft => ({
  hours: String(Math.floor(minutes / 60)),
  minutes: String(minutes % 60).padStart(2, "0"),
});

/**
 * The minutes an hours box holds: a whole number ("2") or a decimal on its
 * way to being laid out ("1.5", "1,5" — 1 h 30 min); 0 when empty; null when
 * it is neither or not a whole number of minutes ("1.33").
 */
const hoursBoxMinutes = (hours: string): number | null => {
  const h = hours.trim();
  if (h === "") return 0;
  if (/^\d{1,2}[.,]?$/.test(h)) return Number(h.replace(/[.,]$/, "")) * 60;
  // Two digits after the point are minutes ("1.30" = 1 h 30), as everywhere
  // else; 60 or more is no length.
  const hmm = /^(\d{1,2})[.,](\d{2})$/.exec(h);
  if (hmm) return Number(hmm[2]) < 60 ? Number(hmm[1]) * 60 + Number(hmm[2]) : null;
  if (!/^\d{1,2}[.,]\d+$/.test(h)) return null;
  const minutes = Number(h.replace(",", ".")) * 60;
  return Math.abs(minutes - Math.round(minutes)) < 1e-9 ? Math.round(minutes) : null;
};

/**
 * The minutes the two boxes mean, or null when they mean none the server
 * would take (empty, not digits, outside 1…`maxMinutes`). An empty box is 0
 * of its unit; the hours may be a decimal ("1.5"), and the minutes may run
 * past 59 while typed ("90", "120") — both are laid out once the field is
 * left (`settleDuration`), never while typed, so a digit still to come is
 * never read against a value the field rewrote.
 */
export const draftMinutes = (d: DurationDraft, maxMinutes: number = MAX_DURATION_MINUTES): number | null => {
  const h = d.hours.trim();
  const m = d.minutes.trim();
  if (h === "" && m === "") return null;
  const hm = hoursBoxMinutes(h);
  if (hm === null || !/^\d{0,4}$/.test(m)) return null;
  return minutesOf(String(hm + (m === "" ? 0 : Number(m))), "minutes", maxMinutes);
};

/**
 * What typing into a box did: the new boxes, whether to go on to the
 * minutes, and whether THIS keystroke wrote those minutes ("30" in the hours
 * is 30 min) — then they are still being typed and the caret goes after
 * them; otherwise minutes already there are selected to be typed over.
 */
export interface BoxInput {
  draft: DurationDraft;
  toMinutes: boolean;
  wroteMinutes: boolean;
}

const HOURS_THEN_SEPARATOR = /^(\d{1,2})\s*(?:[\s:]|[чhժ]\p{L}*)$/u;
const DIGITS_THEN_MINUTE_UNIT = /^(\d{1,3})\s*[мmր]\p{L}*$/u;
// A whole length pasted into the minutes box: a unit or ":" ("2ч 15", "1:30"),
// or hours and minutes apart ("1 30", "1.30").
const HOURS_UNIT_OR_CLOCK = /[:чhժ]|\d[\s.,]\d/u;

/**
 * Text typed or pasted into the HOURS box, keystroke by keystroke as much as
 * whole. No digit alone jumps to the minutes (a "3" may be the start of
 * "30мин"), so nothing typed is ever read as more than was meant:
 *  - 0…10 stay hours; two digits ("10") go on to the minutes;
 *  - a space, ":" or an hour unit after them ("1 ", "1:", "1ч") goes on;
 *  - a number past the ceiling ("30", "90", "120") is minutes, laid out
 *    ("90" → 1 h 30 min), as is one with a minute unit ("30м");
 *  - anything else ("1ч 30мин", "1 30", "1.5") is read whole by
 *    `parseDuration` and laid out in both boxes;
 *  - unreadable stays as typed ("1." on its way to "1.5"), which is no length.
 */
export const typeIntoHours = (text: string, draft: DurationDraft, maxMinutes: number = MAX_DURATION_MINUTES): BoxInput => {
  const maxHours = Math.floor(maxMinutes / 60);
  const raw = text.trim().toLowerCase() === "" ? "" : text.replace(/^\s+/, "").toLowerCase();
  if (raw === "") return { draft: { ...draft, hours: "" }, toMinutes: false, wroteMinutes: false };

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    // Hours stay in their box: no digit jumps on by itself, since the next
    // one may make it minutes ("10" then "0" is 100 min, never 10 h). A space,
    // ":" or "ч" goes on to the minutes.
    if (raw.length <= 2 && n <= maxHours) {
      return { draft: { ...draft, hours: String(n) }, toMinutes: false, wroteMinutes: false };
    }
    // Minutes, as typed ("30", "90", "600"): laid out on leaving, so a third
    // digit still to come is read with the first two ("60" then "0" is 10 h).
    return raw.length <= 4
      ? { draft: { hours: "", minutes: raw }, toMinutes: true, wroteMinutes: true }
      : { draft: { ...draft, hours: text }, toMinutes: false, wroteMinutes: false };
  }

  // A decimal being typed ("1.", "1.3") stays in the box — the next key may
  // make it "1.30" (1 h 30 min); "1.5" left as it is is 1 h 30 min too.
  const decimal = /^(\d{1,2})[.,](\d?)$/.exec(raw);
  if (decimal && Number(decimal[1]) <= maxHours) {
    return { draft: { ...draft, hours: raw }, toMinutes: false, wroteMinutes: false };
  }

  const sep = HOURS_THEN_SEPARATOR.exec(raw);
  if (sep && Number(sep[1]) <= maxHours) {
    return { draft: { ...draft, hours: String(Number(sep[1])) }, toMinutes: true, wroteMinutes: false };
  }

  const asMinutes = DIGITS_THEN_MINUTE_UNIT.exec(raw);
  if (asMinutes) {
    return { draft: typeIntoMinutes(asMinutes[1], { ...draft, hours: "", minutes: "" }, maxMinutes), toMinutes: true, wroteMinutes: true };
  }

  const whole = parseDuration(raw, maxMinutes);
  if (whole !== null) return { draft: draftOf(whole), toMinutes: true, wroteMinutes: true };
  return { draft: { ...draft, hours: text }, toMinutes: false, wroteMinutes: false };
};

/**
 * Text typed or pasted into the MINUTES box. A whole length pasted here
 * ("2ч 15мин", "1:30", "1 30") is laid out in both boxes; otherwise only its
 * digits count (three at most) — the letters of "мин" typed after them are
 * ignored, as a time field ignores them. Past 59 ("75") they stay as typed and
 * mean that many minutes; the field lays them out when it is left.
 */
export const typeIntoMinutes = (text: string, draft: DurationDraft, maxMinutes: number = MAX_DURATION_MINUTES): DurationDraft => {
  const raw = text.trim().toLowerCase();
  if (HOURS_UNIT_OR_CLOCK.test(raw)) {
    const whole = parseDuration(raw, maxMinutes);
    if (whole !== null) return draftOf(whole);
  }
  // Four digits at most, kept as typed: a fourth is not dropped ("1500" is no
  // length — past the ceiling — never 150 laid out as 2:30).
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return { ...draft, minutes: digits };
};

/**
 * The boxes written out once the field is left: a decimal hours value ("1.5"
 * → 1 h 30 min) or minutes past 59 ("90" → 1 h 30 min, "1" h + "75" → 2 h 15)
 * are laid out as hours and minutes. Anything else as it is.
 */
export const settleDuration = (d: DurationDraft, maxMinutes: number = MAX_DURATION_MINUTES): DurationDraft => {
  const m = d.minutes.trim();
  if (!/[.,]/.test(d.hours) && !(/^\d{1,4}$/.test(m) && Number(m) > 59)) return d;
  const minutes = draftMinutes(d, maxMinutes);
  return minutes === null ? d : draftOf(minutes);
};

/**
 * One step up or down from the arrow keys: an hour in the hours box, five
 * minutes in the minutes box (to the next multiple of 5, carrying into the
 * hours), never below 0 or past `maxMinutes`.
 */
export const stepDraft = (draft: DurationDraft, box: "hours" | "minutes", dir: 1 | -1, maxMinutes: number = MAX_DURATION_MINUTES): DurationDraft => {
  const h = hoursBoxMinutes(draft.hours) ?? 0;
  const m = /^\d{1,4}$/.test(draft.minutes.trim()) ? Number(draft.minutes.trim()) : 0;
  const now = h + m;
  const next = box === "hours"
    ? now + dir * 60
    : dir === 1 ? (Math.floor(now / 5) + 1) * 5 : (Math.ceil(now / 5) - 1) * 5;
  const clamped = Math.max(0, Math.min(maxMinutes, next));
  return clamped === 0 ? { hours: "0", minutes: "00" } : draftOf(clamped);
};

/*
 * A clock time in the same two boxes, "[ 14 ] : [ 30 ]" (2026-11-05, owner:
 * the "until" start, no ":" to type). Read into the "HH:mm" the server takes;
 * when that time is and how long until it is the server's answer.
 */

/**
 * The "HH:mm" the boxes mean, or null when they mean no time of day yet:
 * the minutes need both digits, so a time half typed ("14", "14:5") is never
 * priced or started. Leaving the field writes it out (`settleClock`).
 */
export const clockOfDraft = (d: ClockDraft): string | null => {
  const h = d.hours.trim();
  const m = d.minutes.trim();
  if (!/^\d{1,2}$/.test(h) || !/^\d{2}$/.test(m)) return null;
  const hh = Number(h);
  const mm = Number(m);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${m}`;
};

const draftOfClock = (hhmm: string): ClockDraft => ({ hours: hhmm.slice(0, 2), minutes: hhmm.slice(3, 5) });

/**
 * Text typed or pasted into the HOUR box of a clock, with no ":" to type:
 *  - "0", "1", "2" may go on ("14", "23"); "3"…"9" cannot, so they are the
 *    hour and the minutes are next;
 *  - two digits that are an hour ("14") → the minutes are next; two that are
 *    not ("25") → hour "2", minutes "5…";
 *  - three or four digits are hour and minutes: "930" → 9:30, "1430" → 14:30;
 *  - ":", "." or a space after the hour goes on; "14:30", "14.30", "14 30"
 *    land in both boxes;
 *  - anything else stays as typed, which is no time.
 */
export const typeIntoClockHours = (text: string, draft: ClockDraft): BoxInput => {
  const raw = text.trim() === "" ? "" : text.replace(/^\s+/, "");
  if (raw === "") return { draft: { ...draft, hours: "" }, toMinutes: false, wroteMinutes: false };

  if (/^\d+$/.test(raw)) {
    if (raw.length === 1) return { draft: { ...draft, hours: raw }, toMinutes: Number(raw) >= 3, wroteMinutes: false };
    if (raw.length === 2) {
      return Number(raw) <= 23
        ? { draft: { ...draft, hours: raw }, toMinutes: true, wroteMinutes: false }
        : { draft: { hours: raw[0], minutes: raw[1] }, toMinutes: true, wroteMinutes: true };
    }
    if (raw.length <= 4) {
      const cut = raw.length - 2;
      return { draft: { hours: raw.slice(0, cut), minutes: raw.slice(cut) }, toMinutes: true, wroteMinutes: true };
    }
  }

  const sep = /^(\d{1,2})\s*[\s:.,]$/.exec(raw);
  if (sep && Number(sep[1]) <= 23) return { draft: { ...draft, hours: sep[1] }, toMinutes: true, wroteMinutes: false };

  const whole = clockOf(raw) ?? clockOf(raw.replace(/^(\d{1,2})\s+(\d{2})$/, "$1:$2"));
  if (whole !== null) return { draft: draftOfClock(whole), toMinutes: true, wroteMinutes: true };
  return { draft: { ...draft, hours: text }, toMinutes: false, wroteMinutes: false };
};

/**
 * Text typed or pasted into the MINUTE box of a clock: a whole time
 * ("14:30") lands in both boxes; otherwise only its digits count, two at
 * most, and a first digit no minute can follow ("6"…"9") is that minute
 * ("06").
 */
export const typeIntoClockMinutes = (text: string, draft: ClockDraft): ClockDraft => {
  const raw = text.trim();
  if (/\d[:.]\d/.test(raw)) {
    const whole = clockOf(raw);
    if (whole !== null) return draftOfClock(whole);
  }
  // Three digits are kept (and are no time) rather than one silently dropped:
  // "2400" typed key by key must not become 02:40.
  const digits = raw.replace(/\D/g, "").slice(0, 3);
  if (digits.length === 1 && Number(digits) >= 6) return { ...draft, minutes: `0${digits}` };
  return { ...draft, minutes: digits };
};

/**
 * The boxes written out in full once the field is left: an hour alone is on
 * the hour ("9" → 09:00, "до 14" is 14:00), one minute digit is that minute
 * ("14", "5" → 14:05). Anything that is no time is left as typed.
 */
export const settleClock = (d: ClockDraft): ClockDraft => {
  const h = d.hours.trim();
  const m = d.minutes.trim();
  if (!/^\d{1,2}$/.test(h) || !/^\d{0,2}$/.test(m)) return d;
  const hhmm = clockOfDraft({ hours: h, minutes: m.padStart(2, "0") });
  return hhmm === null ? d : draftOfClock(hhmm);
};

/**
 * One step from the arrow keys: an hour in the hour box, five minutes (to
 * the next multiple of 5) in the minute box, round the clock (23 → 00).
 * An empty field starts at 00:00.
 */
export const stepClock = (d: ClockDraft, box: "hours" | "minutes", dir: 1 | -1): ClockDraft => {
  const hhmm = clockOfDraft(settleClock(d)) ?? "00:00";
  const now = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  const next = box === "hours"
    ? now + dir * 60
    : dir === 1 ? (Math.floor(now / 5) + 1) * 5 : (Math.ceil(now / 5) - 1) * 5;
  const day = ((next % 1440) + 1440) % 1440;
  return draftOfClock(`${String(Math.floor(day / 60)).padStart(2, "0")}:${String(day % 60).padStart(2, "0")}`);
};
