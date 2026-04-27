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
