// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { BookingChangedEvent } from "@/realtime/useBookingChanged";
import { toStaffReservation, type StaffReservation } from "@/domain/StaffReservation";
import type { IStaffReservationApi } from "@/types/api";

/**
 * The bookings calendar (2026-11-07, simplified): a two-week date strip with
 * counts, a timeline of seats for the chosen day, the day's list with its
 * actions (Start / Edit / Cancel per row), a click on empty time opens the
 * form there, a booking opens its details, a `.booking.changed` re-reads.
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
  { id: 10, number: 4, label: "№4", platform: "pc", offline: false },
  { id: 11, number: 5, label: "№5", platform: "ps5", offline: false },
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

// Now is Saturday 07.11.2026 15:02. The timeline of the day is 08:00..02:00.
const TODAY = [
  row(1, "2026-11-07", "16:00", 60),
  row(2, "2026-11-07", "18:00", 90, { place_ids: [11], contact_name: null, contact_phone: null, guest_name: "Ani Guest", source: "guest", editable: false }),
  row(3, "2026-11-07", "12:00", 60, { status: "cancelled" }),
  row(4, "2026-11-07", "10:00", 60, { place_ids: [12], contact_name: null, contact_phone: "+374 (77) 12-34-56", editable: false }),
  row(5, "2026-11-07", "23:00", 120, { place_ids: [10], contact_name: "Night" }),
  row(6, "2026-11-09", "14:00", 60, { place_ids: [11] }),
];
const sessions = [{ placeId: 11, startedAt: new Date(2026, 10, 7, 13), endsAt: null, unlimited: true }];

const mount = async (props: Partial<Parameters<typeof BookingsCalendar>[0]> = {}) => {
  await act(async () => {
    render(<BookingsCalendar branchId={BRANCH} places={places} sessions={sessions} {...props} />);
  });
};
const rowOf = (placeId: number) => screen.getAllByTestId("cal-row").find((r) => r.getAttribute("data-place-id") === String(placeId)) as HTMLElement;
const bookingsIn = (el: HTMLElement) => within(el).queryAllByTestId("cal-booking");
const items = () => screen.queryAllByTestId("cal-item");
const item = (id: number) => items().find((i) => i.getAttribute("data-booking-id") === String(id)) as HTMLElement;
const dayChip = (d: string) => screen.getAllByTestId("cal-day").find((c) => c.getAttribute("data-day") === d) as HTMLElement;
const click = async (el: Element, init?: MouseEventInit) => { await act(async () => { fireEvent.click(el, init); }); };
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

describe("the date strip", () => {
  test("two weeks from today, read in one request (with the day before and after)", async () => {
    await mount();
    expect(repo.listReservations).toHaveBeenCalledTimes(1);
    expect(repo.listReservations).toHaveBeenCalledWith(BRANCH, "2026-11-06", "2026-11-21");
    const chips = screen.getAllByTestId("cal-day");
    expect(chips.length).toBe(14);
    expect(chips[0].getAttribute("data-day")).toBe("2026-11-07");
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");
    expect(chips[0].getAttribute("aria-current")).toBe("date");
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.sat, 07.11.2026");
  });

  test("each day carries its booking count (cancelled not counted); empty days carry none", async () => {
    await mount();
    const count = (d: string) => within(dayChip(d)).getByTestId("cal-day-count").textContent;
    expect(count("2026-11-07")).toBe("4");
    expect(count("2026-11-08")).toBe("");
    expect(count("2026-11-09")).toBe("1");
  });

  test("a chip shows its day without asking the server again; › pages two weeks, Today comes back", async () => {
    await mount();
    await click(dayChip("2026-11-09"));
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.mon, 09.11.2026");
    expect(items().map((i) => i.getAttribute("data-booking-id"))).toEqual(["6"]);
    expect(repo.listReservations).toHaveBeenCalledTimes(1);

    await click(screen.getByLabelText("calendar.next"));
    expect(screen.getAllByTestId("cal-day")[0].getAttribute("data-day")).toBe("2026-11-21");
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.sat, 21.11.2026");
    expect(repo.listReservations).toHaveBeenLastCalledWith(BRANCH, "2026-11-20", "2026-12-05");

    await click(screen.getByTestId("cal-today"));
    expect(screen.getByTestId("cal-title").textContent).toBe("branch.weekday.sat, 07.11.2026");
  });
});

describe("the timeline", () => {
  test("a row per seat; offline says so; bookings placed by minutes from 08:00, cancelled hidden", async () => {
    await mount();
    expect(screen.getAllByTestId("cal-row").map((r) => r.getAttribute("data-place-id"))).toEqual(["10", "11", "12"]);
    expect(rowOf(12).className).toContain("is-offline");
    expect(rowOf(12).textContent).toContain("calendar.legend.offline");

    const [b1, night] = bookingsIn(rowOf(10));
    expect(b1.style.getPropertyValue("--tl-start")).toBe(String(8 * 60)); // 16:00
    expect(b1.style.getPropertyValue("--tl-len")).toBe("60");
    expect(b1.getAttribute("data-tip")).toBe("№4 · 16:00–17:00 · Aram · 077 777 777 · bookingDetails.status.pending · calendar.sourceShort.staff");
    // 23:00 to 01:00 is one block on Saturday, not cut at midnight.
    expect([night.style.getPropertyValue("--tl-start"), night.style.getPropertyValue("--tl-len")]).toEqual([String(15 * 60), "120"]);
    expect(screen.queryByText("12:00–13:00")).toBeNull();
    expect(screen.getByTestId("cal-now").textContent).toBe("15:02");
  });

  test("an app guest's booking is outlined with the guest's name; a nameless one says so", async () => {
    await mount();
    const guest = bookingsIn(rowOf(11))[0];
    expect(guest.className).toContain("tl-block--guest");
    expect(guest.textContent).toContain("Ani Guest");
    expect(bookingsIn(rowOf(12))[0].textContent).toContain("reserve.noName");
  });

  test("an unlimited session is green from its start to the right edge, with ∞", async () => {
    await mount();
    const s = within(rowOf(11)).getByTestId("cal-session");
    expect(s.style.getPropertyValue("--tl-start")).toBe(String(5 * 60));
    expect(s.style.getPropertyValue("--tl-len")).toBe(String(18 * 60 - 5 * 60));
    expect(s.className).toContain("tl-block--open");
    expect(s.textContent).toContain("∞");
  });

  test("a click on empty time opens the form on that seat at that time, rounded down to 15 minutes", async () => {
    await mount();
    const track = within(rowOf(11)).getByTestId("cal-track");
    track.getBoundingClientRect = () => ({ left: 0, width: 1080, top: 0, height: 56, bottom: 56, right: 1080, x: 0, y: 0, toJSON: () => ({}) });
    await click(track, { clientX: 133 }); // 08:00 + 133 min = 10:13
    const form = screen.getByTestId("reserve-dialog");
    expect((within(form).getByLabelText("reserve.seat") as HTMLSelectElement).value).toBe("11");
    expect((screen.getByTestId("reserve-start-hours") as HTMLInputElement).value).toBe("10");
    expect((screen.getByTestId("reserve-start-minutes") as HTMLInputElement).value).toBe("00");
  });

  test("the seat filter keeps one seat's row and its bookings; the card's seat is preset", async () => {
    await mount({ focusPlaceId: 11 });
    expect((screen.getByTestId("cal-seat-filter") as HTMLSelectElement).value).toBe("11");
    expect(screen.getAllByTestId("cal-row").length).toBe(1);
    expect(items().map((i) => i.getAttribute("data-booking-id"))).toEqual(["2"]);

    await act(async () => { fireEvent.change(screen.getByTestId("cal-seat-filter"), { target: { value: "" } }); });
    expect(screen.getAllByTestId("cal-row").length).toBe(3);
  });
});

describe("the day's list", () => {
  test("sorted by time, with seat, name or «Без имени», a sanitized tel link, state and source", async () => {
    await mount();
    expect(items().map((i) => i.getAttribute("data-booking-id"))).toEqual(["4", "1", "2", "5"]);
    const nameless = item(4);
    expect(nameless.textContent).toContain("10:00–11:00");
    expect(nameless.textContent).toContain("№6");
    expect(nameless.textContent).toContain("reserve.noName");
    expect(within(nameless).getByText("077 123 456").getAttribute("href")).toBe("tel:+37477123456");
    expect(nameless.textContent).toContain("bookingDetails.status.pending");
    expect(nameless.textContent).toContain("calendar.sourceShort.staff");
    expect(item(2).textContent).toContain("calendar.sourceShort.guest");
  });

  test("Edit only on the desk's own editable bookings; Cancel on any still waiting", async () => {
    await mount();
    expect(within(item(1)).queryByTestId("cal-item-edit")).toBeTruthy();
    expect(within(item(2)).queryByTestId("cal-item-edit")).toBeNull(); // the app guest's
    expect(within(item(4)).queryByTestId("cal-item-edit")).toBeNull(); // the server says not editable
    expect(within(item(2)).queryByTestId("cal-item-cancel")).toBeTruthy();

    await click(within(item(1)).getByTestId("cal-item-edit"));
    expect(screen.getByText("reserve.titleEdit")).toBeTruthy();
  });

  test("a seated or finished booking cannot be cancelled and says what it is", async () => {
    repo.listReservations.mockResolvedValue([
      row(1, "2026-11-07", "14:00", 120, { status: "confirmed", session_id: 70 }),
      row(2, "2026-11-07", "09:00", 60, { status: "finished" }),
    ]);
    await mount();
    expect(within(item(1)).queryByTestId("cal-item-cancel")).toBeNull();
    expect(item(1).textContent).toContain("calendar.legend.active");
    expect(within(item(2)).queryByTestId("cal-item-cancel")).toBeNull();
    expect(item(2).textContent).toContain("bookingDetails.status.finished");
  });

  test("Cancel asks first; No keeps it, Yes cancels and reads again", async () => {
    await mount();
    confirmFn.mockResolvedValueOnce(false);
    await click(within(item(1)).getByTestId("cal-item-cancel"));
    expect(confirmFn).toHaveBeenCalledWith("reserve.cancelConfirm", expect.objectContaining({ destructive: true }));
    expect(repo.cancel).not.toHaveBeenCalled();

    const reads = repo.listReservations.mock.calls.length;
    await click(within(item(1)).getByTestId("cal-item-cancel"));
    expect(repo.cancel).toHaveBeenCalledWith(1);
    expect(repo.listReservations.mock.calls.length).toBe(reads + 1);
  });

  test("an empty day says so and offers to create", async () => {
    await mount();
    await click(dayChip("2026-11-08"));
    expect(screen.getByTestId("cal-list-empty").textContent).toContain("calendar.list.empty");
    await click(within(screen.getByTestId("cal-list-empty")).getByText("calendar.create"));
    expect(screen.getByTestId("reserve-dialog")).toBeTruthy();
  });
});

describe("Start from the calendar", () => {
  test("offered only when given, within two hours, still waiting, its seat not running; calls back with seat and booking", async () => {
    const onStartBooking = vi.fn();
    await mount({ onStartBooking });
    expect(within(item(1)).queryByTestId("cal-item-start")).toBeTruthy(); // 16:00, in 58 minutes
    expect(within(item(2)).queryByTestId("cal-item-start")).toBeNull(); // 18:00: too far, and №5 runs
    expect(within(item(4)).queryByTestId("cal-item-start")).toBeNull(); // 10:00 to 11:00: over
    expect(within(item(5)).queryByTestId("cal-item-start")).toBeNull(); // 23:00: too far

    await click(within(item(1)).getByTestId("cal-item-start"));
    expect(onStartBooking).toHaveBeenCalledWith(10, 1);
  });

  test("a due booking whose seat is running gets no Start", async () => {
    repo.listReservations.mockResolvedValue([row(7, "2026-11-07", "15:30", 60, { place_ids: [11] })]);
    await mount({ onStartBooking: vi.fn() });
    expect(within(item(7)).queryByTestId("cal-item-start")).toBeNull();
  });

  test("without the callback there is no Start at all", async () => {
    await mount();
    expect(screen.queryByTestId("cal-item-start")).toBeNull();
  });

  test("the details dialog offers it too", async () => {
    const onStartBooking = vi.fn();
    await mount({ onStartBooking });
    await click(bookingsIn(rowOf(10))[0]);
    await click(screen.getByTestId("reservation-start"));
    expect(onStartBooking).toHaveBeenCalledWith(10, 1);
    expect(screen.queryByTestId("reservation-details")).toBeNull();
  });
});

describe("a booking's details", () => {
  test("a block opens them: time, tel link, source; Edit only for the desk's editable booking", async () => {
    await mount();
    await click(bookingsIn(rowOf(10))[0]);
    const details = screen.getByTestId("reservation-details");
    expect(details.textContent).toContain("07.11.2026 16:00–17:00");
    expect(within(details).getByText("077 777 777").getAttribute("href")).toBe("tel:+37477777777");
    expect(details.textContent).toContain("calendar.source.staff");
    expect(screen.queryByTestId("reservation-start")).toBeNull(); // no onStartBooking given
    await click(screen.getByTestId("reservation-edit"));
    expect(screen.queryByTestId("reservation-details")).toBeNull();
    expect(screen.getByText("reserve.titleEdit")).toBeTruthy();
  });

  test("an app guest's booking is view and cancel only", async () => {
    await mount();
    await click(bookingsIn(rowOf(11))[0]);
    expect(screen.getByTestId("reservation-details").textContent).toContain("Ani Guest");
    expect(screen.queryByTestId("reservation-edit")).toBeNull();
    expect(screen.getByTestId("reservation-cancel")).toBeTruthy();
  });
});

describe("keeping up with the server", () => {
  test("listens on the private branch channel; an event of this branch re-reads (a burst once), another branch's does not", async () => {
    await mount();
    expect(realtime.channel).toBe(`branch.${BRANCH}`);
    expect(realtime.isPrivate).toBe(true);
    const before = repo.listReservations.mock.calls.length;

    act(() => { realtime.handler?.(event({ branch_id: 99 })); });
    await flush(EVENT_COALESCE_MS + 50);
    expect(repo.listReservations.mock.calls.length).toBe(before);

    act(() => { realtime.handler?.(event()); realtime.handler?.(event()); });
    await flush(EVENT_COALESCE_MS + 50);
    expect(repo.listReservations.mock.calls.length).toBe(before + 1);
  });

  test("a failed first read says so with Retry; Retry reads again", async () => {
    repo.listReservations.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    await mount();
    expect(screen.queryByTestId("cal-timeline")).toBeNull();
    await click(screen.getByText("action.retry"));
    expect(screen.getByTestId("cal-timeline")).toBeTruthy();
    expect(bookingsIn(rowOf(10)).length).toBe(2);
  });

  test("a failed re-read keeps the bookings on screen", async () => {
    await mount();
    repo.listReservations.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    act(() => { realtime.handler?.(event({ kind: "created" })); });
    await flush(EVENT_COALESCE_MS + 50);
    expect(items().length).toBe(4);
    expect(screen.getByText("state.stale.failed")).toBeTruthy();
  });
});
