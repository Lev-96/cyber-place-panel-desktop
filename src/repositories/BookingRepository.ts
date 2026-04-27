import { apiGetBookings, GetBookingsParams } from "@/api/bookings";
import { Booking } from "@/domain/Booking";

const PAGE_SIZE = 100;

export class BookingRepository {
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
