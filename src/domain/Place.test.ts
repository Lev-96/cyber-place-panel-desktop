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

  it("reserved when a booking covers the moment (mid-window)", () => {
    // Place.computeStatus deliberately doesn't distinguish busy
    // vs reserved any more — both "in-window" and "upcoming"
    // bookings paint the tile orange. Promotion to "busy" (red)
    // is RealtimeService's job and only happens when an actual
    // session is running on the place; without that the cashier
    // signal is "this seat is held — convert the booking".
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw());
    const t = new Date(b.start.getTime() + 10 * 60_000);
    expect(p.computeStatus([b], t)).toBe("reserved");
  });

  it("reserved when only upcoming booking", () => {
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw());
    const t = new Date(b.start.getTime() - 60 * 60_000);
    expect(p.computeStatus([b], t)).toBe("reserved");
  });

  it("reserved for a rescheduled booking mid-window", () => {
    // Status `rescheduled` (an extension via PUT
    // /guest-bookings/{id}) MUST keep the tile orange — the
    // backend's BLOCKING_STATUSES treats it as still holding the
    // seat, and the previous (isActiveAt || isUpcoming) combo
    // silently dropped this case.
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw({ status: "rescheduled" }));
    const t = new Date(b.start.getTime() + 10 * 60_000);
    expect(p.computeStatus([b], t)).toBe("reserved");
  });

  it("reserved for a pending booking past its start", () => {
    // Status `pending` with `start <= now <= end` — guest hasn't
    // confirmed by code yet but the window has begun. Must paint
    // orange so the cashier sees the seat is held.
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw({ status: "pending" }));
    const t = new Date(b.start.getTime() + 10 * 60_000);
    expect(p.computeStatus([b], t)).toBe("reserved");
  });

  it("free for a cancelled booking", () => {
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw({ status: "cancelled" }));
    const t = new Date(b.start.getTime() + 10 * 60_000);
    expect(p.computeStatus([b], t)).toBe("free");
  });

  it("free when bookings are in the past", () => {
    const p = new Place(placeRaw());
    const b = new Booking(bookingRaw());
    const t = new Date(b.end.getTime() + 60_000);
    expect(p.computeStatus([b], t)).toBe("free");
  });
});
