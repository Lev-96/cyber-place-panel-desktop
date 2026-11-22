import { tr, Translated } from "@/i18n/translated";
import { Lang } from "@/i18n/translations";
import { IPcApi } from "@/types/sessions";

/** What a seat line reads off a place: the board's `pc.place` and a `/places` row both fit. */
export type SeatLinePlace = Translated & {
  id: number;
  number?: number | null;
  name?: string | null;
};

/**
 * WHICH seat it is, as its card's name line says it: «№4 · Hall VIP», «№4»
 * when the place has no name. The bookings calendar names its seats with the
 * same line (2026-11-15), so a booking reads exactly like the card it is for,
 * and so does the History screen's place filter.
 *
 * ⚠️ The NUMBER leads, always, and it is the same value the player is given
 * on their phone.
 *
 * This used to print the place's name when it had one and fall back to the
 * device's LABEL when the number was missing. Both halves broke the one
 * guarantee that matters here: a cashier and a player looking at the same
 * seat must say the same thing about it. A named seat showed the operator no
 * number at all, and an un-numbered one showed them "PS4-08" while
 * `placesSelect` showed the player `place.id`.
 *
 * `place.number ?? place.id` is exactly what the mobile screen renders, so
 * the two cannot diverge. The name follows as detail: every place that shows
 * the line keeps it to its room with an ellipsis and the full text on hover,
 * so it is the NAME that gets cut, never the number.
 */
export const placeLineOf = (place: SeatLinePlace, lang: Lang): string =>
  numberNameLine(place.number ?? place.id, tr(place, "name", lang));

/**
 * The line itself, from a number and a name already in the reader's language
 * (2026-11-22): «№4 · Hall VIP», «№4» when there is no name or the name only
 * repeats the number («4», «№4»). Every surface that names a seat — the card,
 * the dialogs, the toasts, the notifiers — prints it through here, so a seat
 * reads the same everywhere.
 */
export const numberNameLine = (number: number | string, name: string | null | undefined): string => {
  const head = `№${number}`;
  const trimmed = (name ?? "").trim();
  const repeatsNumber = trimmed === "" || trimmed === String(number) || trimmed === head;
  return repeatsNumber ? head : `${head} · ${trimmed}`;
};

/**
 * The seat of a session, when the row carries its place (`pc.place` — the
 * open-bills list loads it): {@link placeLineOf}; otherwise the device's
 * label, as the receipt printed it before.
 */
export const sessionSeatLine = (
  session: { pc_id: number; pc_label?: string | null; pc?: { id?: number; place?: SeatLinePlace | null } | null },
  lang: Lang,
): string => {
  const place = session.pc?.place;
  // Only a place read WITH its number: the board's listing selects the
  // place's pricing columns and not `number`, and its id is not the number.
  if (place && place.number !== undefined) return placeLineOf(place, lang);
  return session.pc_label || `#${session.pc_id}`;
};

/** {@link placeLineOf} for a device: its place's line, or its own label when it has no place. */
export const seatLineOf = (pc: IPcApi, lang: Lang): string =>
  pc.place ? placeLineOf(pc.place, lang) : tr(pc, "label", lang);

/**
 * A seat line that always says WHAT the seat is (2026-11-22, owner: number
 * and name in «Незакрытые счета»): a seat with no name of its own reads «№2 ·
 * PS5 · Standard» — the words its tile shows — instead of a bare «№2». A
 * named seat is its line unchanged.
 */
export const seatLineWithKind = (line: string, kind: readonly (string | null | undefined)[]): string => {
  if (line.includes(" · ")) return line;
  const words = kind.map((k) => (k ?? "").trim()).filter((k) => k !== "");
  return words.length > 0 ? `${line} · ${words.join(" · ")}` : line;
};
