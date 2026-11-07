// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { BookingChangedEvent } from "@/realtime/useBookingChanged";
import { toStaffReservation, type StaffReservation } from "@/domain/StaffReservation";
import type { IStaffReservationApi } from "@/types/api";

/**
 * The bookings calendar (2026-11-07): what the server listed, in Day / Week /
 * Month; the seat filter; a click on empty time opens the form there; a
 * booking opens its details (edit only where the server says `editable`,
 * cancel asked first); a `.booking.changed` of the branch re-reads.
 */

const repo = vi.hoisted(() => ({ listReservations: vi.fn(), cancel: vi.fn(), reserve: vi.fn(), updateReservation: vi.fn() }));
const confirmFn = vi.hoisted(() => vi.fn());
const realtime = vi.hoisted(() => ({ channel: null as string | null | undefined, isPrivate: false, handler: null as ((e: BookingChangedEvent) => void) | null }));
vi.mock("@/repositories/BookingRepository", () => ({
  bookingRepository: {
    listReservations: (...a: unknown[]) => repo.listReservations(...a),
    cancel: (...a: unknown[]) => repo.cancel(...a),
    reserve: (...a: unknown[]) => repo.reserve(...a),
    updateReservation: (...a: unknown[]) => repo.updateReservation(...a),
  },
}));
vi.mock("@/realtime/useBookingChanged", () => ({
  useBookingChanged: (channel: string | null | undefined, handler: (e: BookingChangedEvent) => void, isPrivate = false) => {
    realtime.channel = channel;
    realtime.handler = handler;
    realtime.isPrivate = isPrivate;
  },
}));
vi.mock("@/realtime/useRealtimeResync", () => ({ useRealtimeResync: () => {} }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => confirmFn }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }) }));

import BookingsCalendar, { type CalendarPlace } from "./BookingsCalendar";
import { EVENT_COALESCE_MS } from "./useStaffReservations";

const BRANCH = 5;
const places: CalendarPlace[] = [
  { id: 10, number: 4, label: "№4", offline: false },
  { id: 11, number: 5, label: "№5", offline: false },
  { id: 12, number: 6, label: "№6", offline: true },
];

const row = (id: number, date: string, time: string, minutes: number, extra: Partial<IStaffReservationApi> = {}): StaffReservation => {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + minutes * 60_000);
  return toStaffReservation({
    id, status: "pending", booking_date: date, start_time: time, duration_minutes: minutes,
    starts_at: start.toISOString(), ends_at: end.toISOString(), place_ids: [10], contact_name: "Aram",
    contact_phone: "+37477777777", guest_name: null, source: "staff", session_id: null, editable: true, ...extra,
  });
};

const TODAY = [
  row(1, "2026-11-07", "15:00", 60),
  row(2, "2026-11-07", "18:00", 90, { place_ids: [11], contact_name: null, contact_phone: null, guest_name: "Ani Guest", source: "guest", editable: false }),
  row(3, "2026-11-07", "12:00", 60, { status: "cancelled" }),
];
const sessions = [{ placeId: 11, startedAt: new Date(2026, 10, 7, 13), endsAt: null, unlimited: true }];

const mount = async (props: Partial<Parameters<typeof BookingsCalendar>[0]> = {}) => {
  await act(async () => {
    render(<BookingsCalendar branchId={BRANCH} places={places} sessions={sessions} {...props} />);
  });
};
const columns = () => screen.getAllByTestId("cal-column");
const bookingsIn = (el: HTMLElement) => within(el).queryAllByTestId("cal-booking");
const tab = async (name: string) => { await act(async () => { fireEvent.click(screen.getByText(name)); }); };
const event = (over: Partial<BookingChangedEvent> = {}): BookingChangedEvent => ({
  kind: "updated", booking_id: 1, branch_id: BRANCH, company_id: 1, code: null, booking_date: null, start_time: null,
  duration_minutes: 60, rescheduled_minutes: 0, place_ids: [10], at: "", ...over,
});
const flush = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 7, 15, 2)); // Saturday
  repo.listReservations.mockReset().mockResolvedValue(TODAY);
  repo.cancel.mockReset().mockResolvedValue(undefined);
  confirmFn.mockReset().mockResolvedValue(true);
  realtime.handler = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Day view", () => {
  test("asks for the day (and the one before, for a booking crossing midnight) of this branch", async () => {
    await mount();
    expect(repo.listReservations).toHaveBeenCalledWith(BRANCH, "2026-11-06", "2026-11-07");
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.sat, 07.11.2026");
  });

  test("a column per seat, bookings placed by minutes, cancelled hidden, offline hatched, now line on today", async () => {
    await mount();
    const [c4, c5, c6] = columns();
    const b1 = bookingsIn(c4);
    expect(b1.length).toBe(1);
    expect(b1[0].style.getPropertyValue("--cal-start")).toBe("900");
    expect(b1[0].style.getPropertyValue("--cal-len")).toBe("60");
    expect(b1[0].getAttribute("data-tip")).toBe("№4 · 15:00–16:00 · Aram · 077 777 777 · bookingDetails.status.pending");
    expect(screen.queryByText("12:00–13:00")).toBeNull();
    expect(c6.className).toContain("cal-grid__col--offline");
    expect(within(c4).getByTestId("cal-now").style.getPropertyValue("--cal-start")).toBe("902");

    // The guest's booking: its own outline and the guest's name.
    const guest = bookingsIn(c5)[0];
    expect(guest.className).toContain("cal-block--guest");
    expect(guest.textContent).toContain("Ani Guest");
  });

  test("an unlimited session is green from its start to now, with ∞", async () => {
    await mount();
    const s = within(columns()[1]).getByTestId("cal-session");
    expect(s.style.getPropertyValue("--cal-start")).toBe("780");
    expect(s.style.getPropertyValue("--cal-len")).toBe(String(902 - 780));
    expect(s.className).toContain("cal-block--open");
    expect(s.textContent).toContain("∞");
  });

  test("the seat filter keeps one seat's column; the card's seat is preset", async () => {
    await mount({ focusPlaceId: 11 });
    expect((screen.getByTestId("cal-seat-filter") as HTMLSelectElement).value).toBe("11");
    expect(columns().length).toBe(1);
    expect(bookingsIn(columns()[0]).map((b) => b.getAttribute("data-booking-id"))).toEqual(["2"]);

    await act(async () => { fireEvent.change(screen.getByTestId("cal-seat-filter"), { target: { value: "" } }); });
    expect(columns().length).toBe(3);
  });

  test("a click on empty time opens the form on that seat at that time, rounded down to 15 minutes", async () => {
    await mount();
    const col = columns()[1];
    col.getBoundingClientRect = () => ({ top: 0, height: 1440, left: 0, width: 100, bottom: 1440, right: 100, x: 0, y: 0, toJSON: () => ({}) });
    await act(async () => { fireEvent.click(col, { clientY: 607 }); });
    const form = screen.getByTestId("reserve-dialog");
    expect((within(form).getByLabelText("reserve.seat") as HTMLSelectElement).value).toBe("11");
    expect((screen.getByTestId("reserve-start-hours") as HTMLInputElement).value).toBe("10");
    expect((screen.getByTestId("reserve-start-minutes") as HTMLInputElement).value).toBe("00");
  });
});

describe("a booking's details", () => {
  test("a staff booking: seat, time, name, phone as a tel link, status; Edit opens the form in edit mode", async () => {
    await mount();
    await act(async () => { fireEvent.click(bookingsIn(columns()[0])[0]); });
    const details = screen.getByTestId("reservation-details");
    expect(details.textContent).toContain("07.11.2026 15:00–16:00");
    expect(within(details).getByText("077 777 777").getAttribute("href")).toBe("tel:+37477777777");
    expect(details.textContent).toContain("calendar.source.staff");

    await act(async () => { fireEvent.click(screen.getByTestId("reservation-edit")); });
    expect(screen.queryByTestId("reservation-details")).toBeNull();
    expect(screen.getByText("reserve.titleEdit")).toBeTruthy();
  });

  test("an app guest's booking is view and cancel only", async () => {
    await mount();
    await act(async () => { fireEvent.click(bookingsIn(columns()[1])[0]); });
    expect(screen.getByTestId("reservation-details").textContent).toContain("Ani Guest");
    expect(screen.queryByTestId("reservation-edit")).toBeNull();
    expect(screen.getByTestId("reservation-cancel")).toBeTruthy();
  });

  test("a staff booking the server says is not editable has no Edit", async () => {
    repo.listReservations.mockResolvedValue([row(1, "2026-11-07", "15:00", 60, { editable: false })]);
    await mount();
    await act(async () => { fireEvent.click(bookingsIn(columns()[0])[0]); });
    expect(screen.queryByTestId("reservation-edit")).toBeNull();
  });

  test("Cancel asks first; No keeps it, Yes cancels and reads the calendar again", async () => {
    await mount();
    await act(async () => { fireEvent.click(bookingsIn(columns()[0])[0]); });

    confirmFn.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.click(screen.getByTestId("reservation-cancel")); });
    expect(confirmFn).toHaveBeenCalledWith("reserve.cancelConfirm", expect.objectContaining({ destructive: true }));
    expect(repo.cancel).not.toHaveBeenCalled();

    const reads = repo.listReservations.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByTestId("reservation-cancel")); });
    expect(repo.cancel).toHaveBeenCalledWith(1);
    expect(screen.queryByTestId("reservation-details")).toBeNull();
    expect(repo.listReservations.mock.calls.length).toBe(reads + 1);
  });
});

describe("Week and Month", () => {
  test("Week asks for Monday to Sunday; with all seats each booking names its seat", async () => {
    repo.listReservations.mockResolvedValue([...TODAY, row(4, "2026-11-03", "20:00", 60, { place_ids: [12] })]);
    await mount();
    await tab("calendar.view.week");
    expect(repo.listReservations).toHaveBeenLastCalledWith(BRANCH, "2026-11-01", "2026-11-08");
    expect(columns().length).toBe(7);
    const tue = columns()[1];
    expect(bookingsIn(tue)[0].textContent).toContain("№6");
    const sat = columns()[5];
    expect(bookingsIn(sat).length).toBe(2);
    // All seats: sessions are not drawn (they would be noise on a day column).
    expect(within(sat).queryByTestId("cal-session")).toBeNull();
  });

  test("Week with one seat shows only its blocks, its session included", async () => {
    await mount({ focusPlaceId: 11 });
    await tab("calendar.view.week");
    const sat = columns()[5];
    expect(bookingsIn(sat).map((b) => b.getAttribute("data-booking-id"))).toEqual(["2"]);
    expect(within(sat).getByTestId("cal-session")).toBeTruthy();
  });

  test("Month shows up to three chips per day and +N; a day click opens it in Day view", async () => {
    repo.listReservations.mockResolvedValue([
      row(1, "2026-11-12", "10:00", 60), row(2, "2026-11-12", "11:00", 60), row(3, "2026-11-12", "12:00", 60),
      row(4, "2026-11-12", "13:00", 60), row(5, "2026-11-12", "14:00", 60),
    ]);
    await mount();
    await tab("calendar.view.month");
    expect(repo.listReservations).toHaveBeenLastCalledWith(BRANCH, "2026-10-25", "2026-12-06");
    const cell = screen.getAllByTestId("cal-month-day").find((c) => c.getAttribute("data-day") === "2026-11-12") as HTMLElement;
    const chips = within(cell).getAllByTestId("cal-month-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["10:00 №4 Aram", "11:00 №4 Aram", "12:00 №4 Aram"]);
    expect(cell.textContent).toContain("+2");

    await act(async () => { fireEvent.click(cell); });
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.thu, 12.11.2026");
    expect(repo.listReservations).toHaveBeenLastCalledWith(BRANCH, "2026-11-11", "2026-11-12");
  });

  test("‹ › and Today move the range", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByLabelText("calendar.next")); });
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.sun, 08.11.2026");
    await act(async () => { fireEvent.click(screen.getByText("calendar.today")); });
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.sat, 07.11.2026");
  });
});

describe("keeping up with the server", () => {
  test("listens on the private branch channel; an event of this branch re-reads (any kind), another branch's does not", async () => {
    await mount();
    expect(realtime.channel).toBe(`branch.${BRANCH}`);
    expect(realtime.isPrivate).toBe(true);
    const before = repo.listReservations.mock.calls.length;

    const evt = event();
    act(() => { realtime.handler?.(event({ branch_id: 99 })); });
    await flush(EVENT_COALESCE_MS + 50);
    expect(repo.listReservations.mock.calls.length).toBe(before);

    // A burst is read once.
    act(() => { realtime.handler?.(evt); realtime.handler?.(evt); });
    await flush(EVENT_COALESCE_MS + 50);
    expect(repo.listReservations.mock.calls.length).toBe(before + 1);
  });

  test("a failed first read says so with Retry; Retry reads again", async () => {
    repo.listReservations.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    await mount();
    expect(screen.queryByTestId("cal-time-grid")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByText("action.retry")); });
    expect(screen.getByTestId("cal-time-grid")).toBeTruthy();
    expect(bookingsIn(columns()[0]).length).toBe(1);
  });

  test("a failed re-read keeps the bookings on screen", async () => {
    await mount();
    repo.listReservations.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    act(() => { realtime.handler?.(event({ kind: "created" })); });
    await flush(EVENT_COALESCE_MS + 50);
    expect(bookingsIn(columns()[0]).length).toBe(1);
    expect(screen.getByText("state.stale.failed")).toBeTruthy();
  });
});
