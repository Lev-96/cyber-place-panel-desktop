import { apiGetBookings, GetBookingsParams } from "@/api/bookings";
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
}

export const bookingRepository = new BookingRepository();
