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

export const apiRescheduleBooking = (id: number, rescheduled_minutes: number) =>
  request<{ message: string }>(`/guest-bookings/${id}`, { method: "PUT", body: { rescheduled_minutes } });

export const apiDeleteBooking = (id: number) =>
  request<{ message: string }>(`/guest-bookings/${id}`, { method: "DELETE" });

export const apiRateBranch = (body: { branch_id: number; rating: number; comment?: string }) =>
  request<{ message: string }>("/branch-rating", { method: "POST", body });
