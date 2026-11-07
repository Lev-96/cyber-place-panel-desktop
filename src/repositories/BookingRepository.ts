import {
  apiDeleteBooking, apiGetBookings, apiReservePlace, apiStaffReservations, apiUpdateReservation,
  GetBookingsParams, ReservationPatch, ReserveBody,
} from "@/api/bookings";
import { friendlyMutation } from "@/api/fallback";
import { Booking } from "@/domain/Booking";
import { StaffReservation, toStaffReservation } from "@/domain/StaffReservation";
import { PaginatedList } from "@/types/api";

const PAGE_SIZE = 100;
const PAGE_SIZE_UI = 12;

export class BookingRepository {
  /** One page of bookings + pagination meta, for the paginated list screen. */
  async listPaged(
    page: number,
    params: Omit<GetBookingsParams, "page" | "per_page">,
  ): Promise<{ data: Booking[]; meta: PaginatedList<Booking>["meta"] }> {
    const res = await apiGetBookings({ ...params, page, per_page: PAGE_SIZE_UI });
    return { data: res.data.map((b) => new Booking(b)), meta: res.meta };
  }

  async listAll(params: Omit<GetBookingsParams, "page" | "per_page">): Promise<Booking[]> {
    const collected: Booking[] = [];
    let page = 1;
    while (true) {
      const res = await apiGetBookings({ ...params, page, per_page: PAGE_SIZE });
      collected.push(...res.data.map((b) => new Booking(b)));
      const lastPage = res.meta?.last_page ?? page;
      if (page >= lastPage || res.data.length < PAGE_SIZE) break;
      page += 1;
    }
    return collected;
  }

  /** Staff reserve a seat for a player who phoned (2026-11-07), now or at a given day and time. */
  async reserve(placeId: number, body: ReserveBody): Promise<Booking> {
    return friendlyMutation(apiReservePlace(placeId, body).then((r) => new Booking(r.booking)));
  }

  /** The branch's bookings calendar, `from`..`to` inclusive ("Y-m-d"). Cancelled rows are not asked for. */
  async listReservations(branchId: number, from: string, to: string): Promise<StaffReservation[]> {
    const res = await apiStaffReservations({ branch_id: branchId, from, to });
    return res.reservations.map(toStaffReservation);
  }

  /** Move / edit a staff reservation; only what `patch` carries changes. */
  async updateReservation(bookingId: number, patch: ReservationPatch): Promise<Booking> {
    return friendlyMutation(apiUpdateReservation(bookingId, patch).then((r) => new Booking(r.booking)));
  }

  /** Cancel a booking — a staff reservation included — by the existing path. */
  async cancel(bookingId: number): Promise<void> {
    await friendlyMutation(apiDeleteBooking(bookingId));
  }
}

export const bookingRepository = new BookingRepository();
