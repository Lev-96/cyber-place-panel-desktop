import { BookingStatusType, IBookingApi, IStaffReservationApi, PaginatedList } from "@/types/api";
import { request } from "./client";

export interface GetBookingsParams {
  company_id?: number;
  branch_id?: number;
  game_id?: number;
  status?: BookingStatusType;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

export const apiGetBookings = (params: GetBookingsParams) =>
  request<PaginatedList<IBookingApi>>("/bookings", { params });

export const apiGetBooking = (id: number) =>
  request<{ booking: IBookingApi & { branch?: { id: number; address: string }; game?: { id: number; name: string; platform: string } } }>(`/bookings/${id}`);

export const apiConfirmBookingByCode = (code: string) =>
  request<{ booking: IBookingApi }>("/bookings/confirm-by-code", { method: "POST", body: { code } });

export const apiDeleteBooking = (id: number) =>
  request<{ message: string }>(`/guest-bookings/${id}`, { method: "DELETE" });

/**
 * What a staff reservation says (backend `ReserveSeatRequest`): who (both
 * optional; the phone Armenian, stored as `+374XXXXXXXX`), when (`date` and
 * `start_time` together, venue-local; absent = now) and for how long
 * (15..300 minutes, default 60).
 */
export interface ReserveBody {
  name?: string | null;
  phone?: string | null;
  minutes?: number;
  /** "Y-m-d" */
  date?: string;
  /** "H:i", 24-hour */
  start_time?: string;
}

/**
 * A change to a staff reservation (backend `UpdateReservationRequest`): only
 * what is sent changes; `name` / `phone` sent null clear it.
 */
export interface ReservationPatch extends ReserveBody {
  place_id?: number;
}

/**
 * Staff reserve a seat for a player who phoned (2026-11-07), now or later.
 * The booking every client shows; cancelled by `apiDeleteBooking`.
 */
export const apiReservePlace = (placeId: number, body: ReserveBody) =>
  request<{ booking: IBookingApi }>(`/places/${placeId}/reserve`, { method: "POST", body });

/**
 * The branch's bookings calendar, `from`..`to` inclusive ("Y-m-d", at most 62
 * days). Live data: `/places` is a cached prefix, so this read opts out of the
 * response cache explicitly.
 */
export const apiStaffReservations = (params: { branch_id: number; from: string; to: string; include_cancelled?: boolean }) =>
  request<{ reservations: IStaffReservationApi[] }>("/places/reservations", {
    params: { ...params, include_cancelled: params.include_cancelled ? 1 : undefined },
    noCache: true,
  });

/** Move / edit a staff reservation; the server refuses a row that is not `editable`, or a conflict, with a sentence. */
export const apiUpdateReservation = (bookingId: number, patch: ReservationPatch) =>
  request<{ booking: IBookingApi }>(`/places/reservations/${bookingId}`, { method: "PATCH", body: patch });
