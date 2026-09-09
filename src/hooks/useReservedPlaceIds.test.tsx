// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingChangedEvent } from "@/realtime/useBookingChanged";
import { useReservedPlaceIds } from "./useReservedPlaceIds";

/**
 * Which seats a reservation is holding, patched straight from the socket.
 *
 * Reverb does not promise order, and this hook adds and removes seat ids from
 * the payload alone. A `created` frame arriving after the `cancelled` that
 * followed it leaves the seat orange and `canStartSession` false — the cashier
 * cannot seat a walk-in on a booking that no longer exists, and nothing on
 * screen explains it. The 30s sweep repairs it eventually; these pin that it
 * does not happen in the first place.
 */

const realtime = vi.hoisted(() => ({
  handler: null as null | ((e: BookingChangedEvent) => void),
}));

vi.mock("@/realtime/useBookingChanged", () => ({
  useBookingChanged: (_c: unknown, onChange: (e: BookingChangedEvent) => void) => {
    realtime.handler = onChange;
  },
}));
vi.mock("@/realtime/bookingScope", () => ({
  resolveBookingScopeChannel: () => ({ name: "branch.7", isPrivate: true }),
}));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, role: "manager" } }),
}));
vi.mock("@/repositories/BookingRepository", () => ({
  bookingRepository: { listAll: () => Promise.resolve([]) },
}));

let seen: Set<number> = new Set();
const Probe = () => {
  seen = useReservedPlaceIds(7);
  return null;
};

const event = (over: Partial<BookingChangedEvent> = {}): BookingChangedEvent =>
  ({
    kind: "created",
    booking_id: 100,
    branch_id: 7,
    place_ids: [10],
    at: "2026-09-10T14:00:00+04:00",
    ...over,
  }) as BookingChangedEvent;

const fire = async (e: BookingChangedEvent) => {
  await act(async () => {
    realtime.handler?.(e);
  });
};

describe("seats held by a reservation", () => {
  beforeEach(async () => {
    realtime.handler = null;
    await act(async () => {
      render(<Probe />);
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("a created booking takes its seats", async () => {
    await fire(event());
    expect(seen.has(10)).toBe(true);
  });

  test("a cancellation hands them back", async () => {
    await fire(event());
    await fire(event({ kind: "cancelled", at: "2026-09-10T14:01:00+04:00" }));
    expect(seen.has(10)).toBe(false);
  });

  test("an out-of-order create cannot undo the cancellation that followed it", async () => {
    await fire(event({ kind: "cancelled", at: "2026-09-10T14:01:00+04:00" }));
    // The older frame, arriving late.
    await fire(event({ kind: "created", at: "2026-09-10T14:00:00+04:00" }));

    expect(
      seen.has(10),
      "a stale frame re-took a seat whose booking was already cancelled",
    ).toBe(false);
  });

  test("a second booking on the same seat is not silenced by the first", async () => {
    await fire(event({ booking_id: 100, kind: "cancelled", at: "2026-09-10T14:05:00+04:00" }));
    // A DIFFERENT booking, with an earlier instant. Ordering is per booking,
    // so this must still be applied.
    await fire(event({ booking_id: 200, kind: "created", at: "2026-09-10T14:02:00+04:00" }));

    expect(seen.has(10)).toBe(true);
  });

  test("an event with no readable instant is still applied", async () => {
    await fire(event({ at: undefined as unknown as string }));
    expect(seen.has(10)).toBe(true);
  });

  test("another branch's booking is ignored", async () => {
    await fire(event({ branch_id: 99 }));
    expect(seen.has(10)).toBe(false);
  });
});
