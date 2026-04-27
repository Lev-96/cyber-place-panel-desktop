import { BookingStatusType, IBookingApi } from "@/types/api";

export class Booking {
  readonly id: number;
  readonly branchId: number;
  readonly gameId: number;
  readonly companyId: number;
  readonly status: BookingStatusType;
  readonly start: Date;
  readonly end: Date;
  readonly placeCount: number;
  readonly platform: string;
  readonly raw: IBookingApi;

  constructor(raw: IBookingApi) {
    this.raw = raw;
    this.id = raw.id;
    this.branchId = raw.branch_id;
    this.gameId = raw.game_id;
    this.companyId = raw.company_id;
    this.status = raw.status;
    this.placeCount = raw.place_booking_count ?? 1;
    this.platform = raw.game?.platform ?? "";
    this.start = Booking.parseStart(raw);
    this.end = new Date(this.start.getTime() + (raw.duration_minutes + (raw.rescheduled_minutes ?? 0)) * 60_000);
  }

  private static parseStart(raw: IBookingApi): Date {
    const date = Booking.normalizeDate(raw.booking_date);
    return new Date(`${date}T${raw.start_time}`);
  }

  /** Accepts "YYYY-MM-DD" or "DD-MM-YYYY", returns "YYYY-MM-DD". */
  private static normalizeDate(s: string): string {
    if (!s) return s;
    const parts = s.split("-");
    if (parts[0]?.length === 4) return s;
    const [d, m, y] = parts;
    return `${y}-${m}-${d}`;
  }

  durationHours(): number {
    return (this.end.getTime() - this.start.getTime()) / 3_600_000;
  }

  isActiveAt(t: Date): boolean {
    return this.status === "confirmed" && this.start <= t && t <= this.end;
  }

  isUpcoming(t: Date): boolean {
    return (this.status === "pending" || this.status === "confirmed") && this.start > t;
  }

  isCompletedBy(t: Date): boolean {
    return this.status === "confirmed" && this.end < t;
  }
}
