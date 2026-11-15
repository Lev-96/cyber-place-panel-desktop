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
export const placeLineOf = (place: SeatLinePlace, lang: Lang): string => {
  const placeNo = place.number ?? place.id;
  const placeName = tr(place, "name", lang).trim();
  return placeName ? `№${placeNo} · ${placeName}` : `№${placeNo}`;
};

/** {@link placeLineOf} for a device: its place's line, or its own label when it has no place. */
export const seatLineOf = (pc: IPcApi, lang: Lang): string =>
  pc.place ? placeLineOf(pc.place, lang) : tr(pc, "label", lang);
