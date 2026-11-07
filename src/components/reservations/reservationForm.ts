/**
 * What the reservation form checks before sending (2026-11-07). A MIRROR of
 * the backend's rules (`App\Support\PersonName`, `App\Rules\ArmenianPhoneNumber`,
 * `ReservationFormRequest`), there only so a typo is said at once instead of
 * after a round trip. The server stays the judge: whatever it refuses is shown
 * as its own sentence.
 */
import type { ReservationPatch } from "@/api/bookings";
import type { StaffReservation } from "@/domain/StaffReservation";
import { formatArmenianPhone, normalizeArmenianPhone } from "@/utils/armenianPhone";

/** The server's bounds for a reservation's length (`ReservationFormRequest`). */
export const MIN_MINUTES = 15;
export const MAX_MINUTES = 300;
export const DEFAULT_MINUTES = 60;

const NAME_MIN = 2;
const NAME_MAX = 120;
/** `PersonName::PATTERN`: a letter first, then letters, marks, spaces, apostrophes, hyphens, dots. */
const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’ʼ՚\-.]*$/u;

/** Trimmed with every run of whitespace one space; null for nothing typed (`PersonName::normalize`). */
export const normalizeName = (raw: string): string | null => {
  const name = raw.replace(/\s+/gu, " ").trim();
  return name === "" ? null : name;
};

/** No name is fine; a name is 2..120 letters, spaces, `'`, `-`, `.`. */
export const isNameValid = (raw: string): boolean => {
  const name = normalizeName(raw);
  if (name === null) return true;
  const length = [...name].length;
  return length >= NAME_MIN && length <= NAME_MAX && NAME_PATTERN.test(name);
};

/** No phone is fine; a phone is a whole Armenian number. */
export const isPhoneValid = (masked: string): boolean => masked.trim() === "" || normalizeArmenianPhone(masked) !== null;

/** What the form holds once every field reads as something. */
export interface ReservationDraft {
  placeId: number;
  /** "Y-m-d" */
  date: string;
  /** "H:i" */
  startTime: string;
  minutes: number;
  /** As typed; normalised here. */
  name: string;
  /** As masked; normalised here. */
  phone: string;
}

/** The body of a new reservation: the time always (the form shows one), name and phone only when given. */
export const createBody = (d: ReservationDraft) => {
  const name = normalizeName(d.name);
  const phone = normalizeArmenianPhone(d.phone);
  return {
    minutes: d.minutes,
    date: d.date,
    start_time: d.startTime,
    ...(name !== null ? { name } : {}),
    ...(phone !== null ? { phone } : {}),
  };
};

/**
 * What an edit changes, field by field against the reservation as the server
 * gave it — and whether it MOVES it (another seat, day, start or length),
 * which is asked before sending. A cleared name or phone is sent as null.
 */
export const editPatch = (r: StaffReservation, d: ReservationDraft): { patch: ReservationPatch; moves: boolean } => {
  const patch: ReservationPatch = {};
  if (!r.place_ids.includes(d.placeId) || r.place_ids.length !== 1) patch.place_id = d.placeId;
  if (d.date !== r.booking_date) patch.date = d.date;
  if (d.startTime !== r.start_time) patch.start_time = d.startTime;
  if (d.minutes !== r.duration_minutes) patch.minutes = d.minutes;
  const moves = Object.keys(patch).length > 0;

  const name = normalizeName(d.name);
  if (name !== (r.contact_name ?? null)) patch.name = name;
  // Untouched (shown as it was stored) is unchanged, whatever shape it was stored in.
  if (d.phone !== formatArmenianPhone(r.contact_phone)) {
    const phone = d.phone.trim() === "" ? null : normalizeArmenianPhone(d.phone);
    if (phone !== (r.contact_phone ?? null)) patch.phone = phone;
  }
  return { patch, moves };
};
