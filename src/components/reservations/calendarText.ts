import type { StaffReservation } from "@/domain/StaffReservation";
import { reservationWho } from "@/domain/StaffReservation";
import { formatArmenianPhone } from "@/utils/armenianPhone";
import { hm } from "./calendarModel";

/** How the calendar names seats: by the board's label ("№4"), an unknown id as "#id". */
export interface SeatNames {
  labelOf: (placeId: number) => string;
  labelsOf: (placeIds: readonly number[]) => string;
}

export const seatNames = (places: readonly { id: number; label: string }[]): SeatNames => {
  const byId = new Map(places.map((p) => [p.id, p.label]));
  const labelOf = (id: number) => byId.get(id) ?? `#${id}`;
  return { labelOf, labelsOf: (ids) => ids.map(labelOf).join(", ") };
};

/** The window as a line: "15:00–16:00". */
export const windowOf = (r: StaffReservation): string => `${hm(r.start)}–${hm(r.end)}`;

/** A `tel:` link for a stored phone: digits and a leading + only, nothing a URL could carry. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^+0-9]/g, "")}`;

/** A booking's tooltip and accessible name: seat, time, who, phone, status (the parts it has). */
export const bookingTip = (r: StaffReservation, seats: SeatNames, t: (key: string) => string): string =>
  [
    seats.labelsOf(r.place_ids),
    windowOf(r),
    reservationWho(r) ?? t("reserve.noName"),
    formatArmenianPhone(r.contact_phone) || null,
    t(`bookingDetails.status.${r.status}`),
    t(r.source === "guest" ? "calendar.sourceShort.guest" : "calendar.sourceShort.staff"),
  ].filter((part): part is string => !!part).join(" · ");
