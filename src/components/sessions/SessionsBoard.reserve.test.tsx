// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import { Booking } from "@/domain/Booking";

/**
 * A seat reserved by phone, on the board (2026-11-07): a free seat offers
 * «Забронировать»; a reserved one shows who is coming and offers «Пришёл» —
 * the ordinary start carrying the reservation — and «Отменить бронь».
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
const bookings = vi.hoisted(() => ({ listAll: vi.fn(), cancel: vi.fn(), reserve: vi.fn() }));
const reserved = vi.hoisted(() => ({ ids: new Set<number>() }));
const started = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/repositories/BookingRepository", () => ({
  bookingRepository: {
    listAll: (...a: unknown[]) => bookings.listAll(...a),
    cancel: (...a: unknown[]) => bookings.cancel(...a),
    reserve: (...a: unknown[]) => bookings.reserve(...a),
  },
}));
vi.mock("./StartSessionDialog", () => ({
  default: (props: Record<string, unknown>) => { started.props = props; return <div data-testid="start-dialog" />; },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => reserved.ids }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }) }));

import SessionsBoard from "./SessionsBoard";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

const pc = (): IPcApi => ({
  id: 1, branch_id: 7, place_id: 10, label: "PS 4", kind: PC_KIND.Ps, status: PC_STATUS.Online,
  last_seen_at: new Date().toISOString(),
  place: { id: 10, number: 4, platform: "ps5", type: "standard", status: "active" },
} as unknown as IPcApi);

/** Today in LOCAL time, as the booking's own date is (never UTC's, which is yesterday after midnight here). */
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const hold = () => new Booking({
  id: 77, company_id: 1, branch_id: 7, game_id: null, guest_id: null, status: "pending", code: 123456,
  booking_date: localDate(), start_time: new Date().toTimeString().slice(0, 8),
  duration_minutes: 60, end_time: "23:59:00", place_booking_count: 1, place_ids: [10], place_numbers: [4],
  contact_name: "Aram", contact_phone: "+374 91 123456",
} as never);

const mount = async () => {
  await act(async () => { render(<ConfirmProvider><MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter></ConfirmProvider>); });
  // The reservation's details are read after the board (useReservationsByPlace).
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const action = (name: string) => document.querySelector(`[data-action="${name}"]`) as HTMLButtonElement | null;

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([pc()]);
  repo.listActive.mockReset().mockResolvedValue([]);
  bookings.listAll.mockReset().mockResolvedValue([]);
  bookings.cancel.mockReset().mockResolvedValue(undefined);
  reserved.ids = new Set();
  started.props = null;
});

describe("reserving from the board", () => {
  test("a free seat offers Start and «Забронировать», which opens the reserve dialog", async () => {
    await mount();
    expect(action("start")).not.toBeNull();
    expect(action("arrived")).toBeNull();

    await act(async () => { fireEvent.click(action("reserve")!); });
    expect(screen.getByTestId("reserve-dialog")).toBeTruthy();
  });

  test("a reserved seat shows who is coming; «Пришёл» opens the start carrying the reservation", async () => {
    reserved.ids = new Set([10]);
    bookings.listAll.mockResolvedValue([hold()]);
    await mount();

    expect(screen.getByTestId("reservation-contact").textContent).toContain("Aram");
    expect(screen.getByTestId("reservation-contact").textContent).toContain("+374 91 123456");
    expect(action("reserve")).toBeNull();
    expect(action("start")).toBeNull();

    await act(async () => { fireEvent.click(action("arrived")!); });
    expect(screen.getByTestId("start-dialog")).toBeTruthy();
    expect(started.props?.bookingId).toBe(77);
  });

  test("«Отменить бронь» asks first and cancels by the booking's id", async () => {
    reserved.ids = new Set([10]);
    bookings.listAll.mockResolvedValue([hold()]);
    await mount();

    await act(async () => { fireEvent.click(action("cancel-reservation")!); });
    expect(bookings.cancel).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.confirm" })); });

    expect(bookings.cancel).toHaveBeenCalledWith(77);
  });
});
