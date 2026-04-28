import { describe, expect, it } from "vitest";
import { IBookingApi, IBranchPlace } from "@/types/api";
import { Booking } from "./Booking";
import { Place } from "./Place";

const placeRaw = (overrides: Partial<IBranchPlace> = {}): IBranchPlace => ({
  id: 1,
  branch_id: 1,
  type: "standard",
  status: "active",
  platform: "pc",
  games: [],
  ...overrides,
});

const bookingRaw = (overrides: Partial<IBookingApi> = {}): IBookingApi => ({
  id: 10,
  company_id: 1,
  branch_id: 1,
  game_id: 1,
  guest_id: 1,
  booking_date: "2026-04-28",
  start_time: "12:00:00",
  duration_minutes: 60,
  end_time: "13:00:00",
  status: "confirmed",
  code: 1,
  place_booking_count: 1,
  game: { id: 1, platform: "pc", name: "CS" },
  ...overrides,
});

describe("Place.computeStatus", () => {
  it("inactive place is maintenance", () => {
    const p = new Place(placeRaw({ status: "inactive" }));
    expect(p.computeStatus([], new Date())).toBe("maintenance");
  });

  it("free with no bookings", () => {
    const p = new Place(placeRaw());
    expect(p.computeStatus([], new Date())).toBe("free");
  });

  it("busy when active booking covers time", () => {
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw());
    const t = new Date(b.start.getTime() + 10 * 60_000);
    expect(p.computeStatus([b], t)).toBe("busy");
  });

  it("reserved when only upcoming booking", () => {
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw());
    const t = new Date(b.start.getTime() - 60 * 60_000);
    expect(p.computeStatus([b], t)).toBe("reserved");
  });

  it("free when bookings are in the past", () => {
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw());
    const t = new Date(b.end.getTime() + 60_000);
    expect(p.computeStatus([b], t)).toBe("free");
  });
});
