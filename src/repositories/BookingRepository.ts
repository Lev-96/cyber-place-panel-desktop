import { apiDeleteBooking, apiGetBookings, apiReservePlace, GetBookingsParams } from "@/api/bookings";
import { friendlyMutation } from "@/api/fallback";
import { Booking } from "@/domain/Booking";
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

  /** Staff reserve a free seat for a player who phoned (2026-11-07). */
  async reserve(placeId: number, body: { name: string; phone?: string; minutes?: number }): Promise<Booking> {
    return friendlyMutation(apiReservePlace(placeId, body).then((r) => new Booking(r.booking)));
  }

  /** Cancel a booking — a staff reservation included — by the existing path. */
  async cancel(bookingId: number): Promise<void> {
    await friendlyMutation(apiDeleteBooking(bookingId));
  }
}

export const bookingRepository = new BookingRepository();
