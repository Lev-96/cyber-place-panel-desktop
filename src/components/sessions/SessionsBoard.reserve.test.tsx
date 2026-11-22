// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import { Booking } from "@/domain/Booking";

/**
 * A seat reserved by phone, on the board (2026-11-07): a free seat offers
 * «Забронировать»; a reserved one shows its time — who is coming in its
 * tooltip, never as a big word — and offers Start, the ordinary start
 * carrying the reservation, and «Отменить бронь».
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
const bookings = vi.hoisted(() => ({ listAll: vi.fn(), cancel: vi.fn(), reserve: vi.fn() }));
const reserved = vi.hoisted(() => ({ ids: new Set<number>() }));
const started = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
const calendar = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock("@/components/reservations/BookingsCalendarModal", () => ({
  default: (props: Record<string, unknown>) => { calendar.props = props; return <div data-testid="calendar-modal" />; },
}));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    // At the till (2026-11-22): Stop holds the bill; «Продолжить игру» lets it run.
    checkout: vi.fn().mockResolvedValue({}),
    releaseCheckout: vi.fn().mockResolvedValue({}),
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
  calendar.props = null;
});

describe("reserving from the board", () => {
  test("a free seat offers Start and «Забронировать», which opens the calendar on that seat", async () => {
    await mount();
    expect(action("start")).not.toBeNull();
    expect(action("cancel-reservation")).toBeNull();

    await act(async () => { fireEvent.click(action("reserve")!); });
    expect(screen.getByTestId("calendar-modal")).toBeTruthy();
    expect(calendar.props?.focusPlaceId).toBe(10);
    expect(calendar.props?.branchId).toBe(7);
    expect((calendar.props?.places as { id: number; label: string }[]).map((p) => p.id)).toEqual([10]);
  });

  // 2026-11-15 (owner): the calendar names a seat as the board's card does,
  // «№N · name», not the bare number; the board's own name line is the one source.
  test("the calendar names each seat as its card does: «№N · name», «№N» when it has no name", async () => {
    repo.listPcs.mockResolvedValue([
      { ...pc(), place: { ...pc().place, name: "Hall VIP" } },
      { ...pc(), id: 2, place_id: 11, label: "PS 5", place: { id: 11, number: 5, platform: "ps5", type: "standard", status: "active" } },
    ]);
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("board-calendar")); });
    const seats = calendar.props?.places as { id: number; label: string }[];
    expect(seats.map((p) => p.label)).toEqual(["№4 · Hall VIP", "№5"]);
    // The card says the very same thing.
    const lines = Array.from(document.querySelectorAll(".place-cell .id")).map((el) => el.textContent);
    expect(lines).toEqual(["№4 · Hall VIP", "№5"]);
  });

  test("«Старт» on a booking in the calendar opens Start on its seat with the booking chosen", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("board-calendar")); });
    await act(async () => { (calendar.props?.onStartBooking as (p: number, b: number) => void)(10, 77); });
    expect(screen.queryByTestId("calendar-modal")).toBeNull();
    expect(screen.getByTestId("start-dialog")).toBeTruthy();
    expect(started.props?.bookingId).toBe(77);
  });

  test("a free seat reserved later says until when it is free", async () => {
    const at = new Date(Date.now() + 3 * 3_600_000);
    repo.listPcs.mockResolvedValue([{ ...pc(), next_booking_start: at.toISOString() }]);
    await mount();
    const hm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
    expect(screen.getByTestId("free-until").textContent).toBe("start.freeUntilCard".replace("{0}", hm));
  });

  test("a free seat reserved later is drawn yellow, and still starts (2026-11-08)", async () => {
    const at = new Date(Date.now() + 3 * 3_600_000);
    repo.listPcs.mockResolvedValue([{ ...pc(), next_booking_start: at.toISOString() }]);
    await mount();
    const cell = screen.getByTestId("free-until").closest(".place-cell") as HTMLElement;
    expect(cell.classList.contains("session-card--booking-ahead")).toBe(true);
    expect(cell.getAttribute("data-tone")).toBe("booked");
    // Still a free seat: the state the Start button follows is unchanged.
    expect(cell.classList.contains("session-card--seat-free")).toBe(true);
  });

  test("«Свободно» and «Свободно до …» share one place, swapped on hover (2026-11-08)", async () => {
    const at = new Date(Date.now() + 3 * 3_600_000);
    repo.listPcs.mockResolvedValue([{ ...pc(), next_booking_start: at.toISOString() }]);
    await mount();
    const swap = screen.getByTestId("free-until").parentElement as HTMLElement;
    expect(swap.classList.contains("session-card__status-swap")).toBe(true);
    const word = swap.querySelector(".session-card__status-word") as HTMLElement;
    expect(word.textContent).toBe("session.free");
    // Read aloud once: the full sentence, not the word as well.
    expect(word.getAttribute("aria-hidden")).toBe("true");
  });

  test("a seat with nothing booked ahead stays the free colour", async () => {
    repo.listPcs.mockResolvedValue([{ ...pc(), next_booking_start: null }]);
    await mount();
    const cell = document.querySelector(".place-cell") as HTMLElement;
    expect(cell.classList.contains("session-card--booking-ahead")).toBe(false);
    expect(cell.getAttribute("data-tone")).toBe("free");
  });

  // «Забронировано» in the board's counts (2026-11-22, owner): a seat reserved
  // now and not taken counts there, not as free — the tile's own rule.
  test("a seat reserved now counts as reserved, not free", async () => {
    reserved.ids = new Set([pc().place_id as number]);
    await mount();
    expect(screen.getByTestId("board-count-total").textContent).toBe("session.countTotal1");
    expect(screen.getByTestId("board-count-busy").textContent).toBe("session.countBusy0");
    expect(screen.getByTestId("board-count-booked").textContent).toBe("session.countBooked1");
    expect(screen.getByTestId("board-count-free").textContent).toBe("session.countFree0");
  });

  // The dot on «Календарь броней» (2026-11-22, owner): seats with a
  // reservation now or ahead; none, no dot.
  test("the calendar button carries a dot with the seats reserved now or ahead", async () => {
    repo.listPcs.mockResolvedValue([{ ...pc(), next_booking_start: null }]);
    await mount();
    expect(screen.queryByTestId("board-calendar-dot")).toBeNull();
    cleanup();
    reserved.ids = new Set([pc().place_id as number]);
    await mount();
    expect(screen.getByTestId("board-calendar-dot").textContent).toBe("1");
    cleanup();
    reserved.ids = new Set();
    repo.listPcs.mockResolvedValue([{ ...pc(), next_booking_start: new Date(Date.now() + 3600_000).toISOString() }]);
    await mount();
    expect(screen.getByTestId("board-calendar-dot").textContent).toBe("1");
  });

  test("the header's «Календарь броней» opens it on every seat", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("board-calendar")); });
    expect(screen.getByTestId("calendar-modal")).toBeTruthy();
    expect(calendar.props?.focusPlaceId).toBeUndefined();
  });

  test("a reserved seat shows its time, who is coming in the tooltip; Start asks who sits down", async () => {
    reserved.ids = new Set([10]);
    bookings.listAll.mockResolvedValue([hold()]);
    await mount();

    const line = screen.getByTestId("reservation-contact");
    expect(line.textContent).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
    expect(line.textContent).not.toContain("session.reserved");
    expect(line.getAttribute("data-tip")).toContain("Aram");
    expect(line.getAttribute("data-tip")).toContain("091 123 456");
    expect(line.getAttribute("data-tip")).toContain("session.reserved");
    expect(action("reserve")).toBeNull();

    await act(async () => { fireEvent.click(action("start")!); });
    expect(screen.getByTestId("start-dialog")).toBeTruthy();
    // Who sits down is asked in Start: the reservation is never assumed.
    expect(started.props?.bookingId).toBeUndefined();
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
