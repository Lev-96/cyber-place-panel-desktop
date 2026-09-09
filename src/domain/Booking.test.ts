import { describe, expect, it } from "vitest";
import { IBookingApi } from "@/types/api";
import { Booking } from "./Booking";

const baseRaw = (overrides: Partial<IBookingApi> = {}): IBookingApi => ({
  id: 1,
  company_id: 1,
  branch_id: 1,
  game_id: 1,
  guest_id: 1,
  booking_date: "2026-04-28",
  start_time: "12:00:00",
  duration_minutes: 60,
  end_time: "13:00:00",
  status: "confirmed",
  code: 12345,
  place_booking_count: 1,
  game: { id: 1, platform: "pc", name: "CS" },
  ...overrides,
});

describe("Booking", () => {
  it("parses ISO-style dates", () => {
    const b = new Booking(baseRaw());
    expect(b.start.getUTCFullYear()).toBe(2026);
    expect(b.durationHours()).toBeCloseTo(1, 5);
  });

  it("parses DD-MM-YYYY-style dates", () => {
    const b = new Booking(baseRaw({ booking_date: "28-04-2026" }));
    expect(b.start.getUTCFullYear()).toBe(2026);
  });

  it("isActiveAt returns true only for confirmed bookings within window", () => {
    const b = new Booking(baseRaw());
    const t = new Date(b.start.getTime() + 30 * 60_000);
    expect(b.isActiveAt(t)).toBe(true);
  });

  it("isActiveAt false for pending status", () => {
    const b = new Booking(baseRaw({ status: "pending" }));
    const t = new Date(b.start.getTime() + 30 * 60_000);
    expect(b.isActiveAt(t)).toBe(false);
  });

  it("isUpcoming detects future bookings", () => {
    const b = new Booking(baseRaw());
    const t = new Date(b.start.getTime() - 60_000);
    expect(b.isUpcoming(t)).toBe(true);
  });

  it("isCompletedBy true for past confirmed", () => {
    const b = new Booking(baseRaw());
    const t = new Date(b.end.getTime() + 60_000);
    expect(b.isCompletedBy(t)).toBe(true);
  });

  it("durationHours includes rescheduled minutes", () => {
    const b = new Booking(baseRaw({ duration_minutes: 60, rescheduled_minutes: 30 }));
    expect(b.durationHours()).toBeCloseTo(1.5, 5);
  });

  /**
   * How far ahead a reservation reaches back and takes the seat.
   *
   * `isReservingAt` used to ask only whether the end was still in the future,
   * so a booking made for next Saturday held the seat every day until then and
   * `canStartSession` refused every walk-in on it. These pin the horizon in
   * both directions, because a rule with no test is a rule that drifts back.
   */
  describe("how far ahead a reservation holds the seat", () => {
    it("holds it while it is actually running", () => {
      const b = new Booking(baseRaw());
      const t = new Date(b.start.getTime() + 10 * 60_000);
      expect(b.isReservingAt(t)).toBe(true);
    });

    it("holds it shortly before it starts, so nobody is seated to be moved", () => {
      const b = new Booking(baseRaw());
      const t = new Date(b.start.getTime() - 60 * 60_000);
      expect(b.isReservingAt(t)).toBe(true);
    });

    it("does NOT hold it a day ahead — the venue can sell today", () => {
      const b = new Booking(baseRaw());
      const t = new Date(b.start.getTime() - 24 * 60 * 60_000);
      expect(b.isReservingAt(t)).toBe(false);
    });

    it("does NOT hold it a week ahead", () => {
      const b = new Booking(baseRaw());
      const t = new Date(b.start.getTime() - 7 * 24 * 60 * 60_000);
      expect(b.isReservingAt(t)).toBe(false);
    });

    it("has let go once it is over", () => {
      const b = new Booking(baseRaw());
      const t = new Date(b.end.getTime() + 60_000);
      expect(b.isReservingAt(t)).toBe(false);
    });

    it("a cancelled booking holds nothing, however close it is", () => {
      const b = new Booking(baseRaw({ status: "cancelled" }));
      const t = new Date(b.start.getTime() - 60_000);
      expect(b.isReservingAt(t)).toBe(false);
    });

    it("a seat free now but booked later is upcoming, not reserved", () => {
      const b = new Booking(baseRaw());
      const t = new Date(b.start.getTime() - 24 * 60 * 60_000);
      expect(b.isReservingAt(t)).toBe(false);
      expect(b.isUpcomingAt(t)).toBe(true);
    });

    it("…and once it is near, it is reserved rather than merely upcoming", () => {
      const b = new Booking(baseRaw());
      const t = new Date(b.start.getTime() - 60 * 60_000);
      expect(b.isReservingAt(t)).toBe(true);
      expect(b.isUpcomingAt(t)).toBe(false);
    });
  });
});
