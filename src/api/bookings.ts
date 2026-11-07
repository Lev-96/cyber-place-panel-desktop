import { BookingStatusType, IBookingApi, PaginatedList } from "@/types/api";
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
 * Staff reserve a free seat for a player who phoned (2026-11-07): a name, a
 * phone, how long to hold it (minutes, default the server's 60). The booking
 * every client shows; cancelled by `apiDeleteBooking`.
 */
export const apiReservePlace = (placeId: number, body: { name: string; phone?: string; minutes?: number }) =>
  request<{ booking: IBookingApi }>(`/places/${placeId}/reserve`, { method: "POST", body });
