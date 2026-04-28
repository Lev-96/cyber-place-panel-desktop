import { describe, expect, it } from "vitest";
import { Booking } from "@/domain/Booking";
import { Money } from "@/domain/Money";
import { IBookingApi, IBranchApi } from "@/types/api";
import { IPricingPolicy } from "./PricingPolicy";
import { RevenueCalculator } from "./RevenueCalculator";

const mkBooking = (overrides: Partial<IBookingApi>): Booking =>
  new Booking({
    id: 1, company_id: 1, branch_id: 1, game_id: 1, guest_id: 1,
    booking_date: "2026-04-01", start_time: "12:00:00",
    duration_minutes: 60, end_time: "13:00:00",
    status: "confirmed", code: 1, place_booking_count: 1,
    game: { id: 1, platform: "pc", name: "x" },
    ...overrides,
  });

const mkBranch = (id: number): IBranchApi => ({
  id, company_id: 1, city: "", country: "", address: "",
  phone: null, branch_logo_path: "", status: "active",
  ratings_avg_rating: null, service_count: 0,
});

const fixedPrice = (perBooking: number): IPricingPolicy => ({
  priceFor: () => new Money(perBooking),
});

describe("RevenueCalculator.forCompanyMonth", () => {
  it("returns zero report when no bookings", async () => {
    const calc = new RevenueCalculator({
      bookings: { listAll: async () => [] },
      branches: { list: async () => [] },
      commissions: { getPercent: async () => 5 },
      pricing: fixedPrice(0),
      now: () => new Date("2026-05-01T00:00:00Z"),
    });
    const r = await calc.forCompanyMonth(1, { year: 2026, month: 4 });
    expect(r.bookingsCount).toBe(0);
    expect(r.grossRevenue.amount).toBe(0);
    expect(r.amountDue().amount).toBe(0);
  });

  it("counts only completed bookings (status=confirmed AND end<now)", async () => {
    const now = () => new Date("2026-04-30T00:00:00Z");
    const past = mkBooking({ id: 1, booking_date: "2026-04-15", status: "confirmed" });
    const future = mkBooking({ id: 2, booking_date: "2026-05-15", status: "confirmed" });
    const cancelled = mkBooking({ id: 3, booking_date: "2026-04-10", status: "cancelled" });

    const calc = new RevenueCalculator({
      bookings: { listAll: async () => [past, future, cancelled] },
      branches: { list: async () => [mkBranch(1)] },
      commissions: { getPercent: async () => 10 },
      pricing: fixedPrice(500),
      now,
    });
    const r = await calc.forCompanyMonth(1, { year: 2026, month: 4 });
    expect(r.bookingsCount).toBe(1);
    expect(r.grossRevenue.amount).toBe(500);
    expect(r.amountDue().amount).toBe(50);
  });

  it("sums gross revenue across multiple completed bookings", async () => {
    const now = () => new Date("2026-05-01T00:00:00Z");
    const calc = new RevenueCalculator({
      bookings: { listAll: async () => [
        mkBooking({ id: 1, booking_date: "2026-04-01" }),
        mkBooking({ id: 2, booking_date: "2026-04-02" }),
        mkBooking({ id: 3, booking_date: "2026-04-03" }),
      ]},
      branches: { list: async () => [] },
      commissions: { getPercent: async () => 7 },
      pricing: fixedPrice(1000),
      now,
    });
    const r = await calc.forCompanyMonth(1, { year: 2026, month: 4 });
    expect(r.bookingsCount).toBe(3);
    expect(r.grossRevenue.amount).toBe(3000);
    expect(r.amountDue().amount).toBe(210);
    expect(r.commissionPercent).toBe(7);
  });

  it("uses the configured percent in the report", async () => {
    const calc = new RevenueCalculator({
      bookings: { listAll: async () => [] },
      branches: { list: async () => [] },
      commissions: { getPercent: async () => 12.5 },
      pricing: fixedPrice(0),
      now: () => new Date(),
    });
    const r = await calc.forCompanyMonth(42, { year: 2026, month: 1 });
    expect(r.commissionPercent).toBe(12.5);
    expect(r.companyId).toBe(42);
  });
});
