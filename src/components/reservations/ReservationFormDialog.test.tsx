// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { StaffReservation } from "@/domain/StaffReservation";

/**
 * The reservation form (2026-11-07): optional name and phone, the phone mask
 * and the normalised number sent, the name rule, a move confirmed but a
 * name-only change not, and the server's refusal kept on screen.
 */

const repo = vi.hoisted(() => ({ reserve: vi.fn(), updateReservation: vi.fn() }));
const confirmFn = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/repositories/BookingRepository", () => ({
  bookingRepository: {
    reserve: (...a: unknown[]) => repo.reserve(...a),
    updateReservation: (...a: unknown[]) => repo.updateReservation(...a),
  },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: (...a: unknown[]) => toast(...a) } }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => confirmFn }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }) }));

import ReservationFormDialog, { type ReservationFormMode } from "./ReservationFormDialog";

const places = [{ id: 10, label: "№4" }, { id: 11, label: "№5" }];
const onSaved = vi.fn();

const mount = async (mode: ReservationFormMode = { kind: "create", placeId: 10 }) => {
  await act(async () => { render(<ReservationFormDialog places={places} mode={mode} onClose={() => {}} onSaved={onSaved} />); });
};
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = async (el: HTMLElement, value: string) => {
  await act(async () => { fireEvent.change(el, { target: { value } }); });
};
const confirmBtn = () => screen.getByTestId("reserve-confirm") as HTMLButtonElement;
const submit = async () => { await act(async () => { fireEvent.click(confirmBtn()); }); };

const staffRow = (extra: Partial<StaffReservation> = {}): StaffReservation => ({
  id: 77, status: "pending", booking_date: "2026-11-07", start_time: "18:00", duration_minutes: 60,
  starts_at: "2026-11-07T18:00:00+04:00", ends_at: "2026-11-07T19:00:00+04:00", place_ids: [10],
  contact_name: "Aram", contact_phone: "+37477777777", guest_name: null, source: "staff", session_id: null,
  editable: true, start: new Date(2026, 10, 7, 18), end: new Date(2026, 10, 7, 19), ...extra,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 7, 15, 2, 30));
  repo.reserve.mockReset().mockResolvedValue({});
  repo.updateReservation.mockReset().mockResolvedValue({});
  confirmFn.mockReset().mockResolvedValue(true);
  toast.mockReset();
  onSaved.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("a new reservation", () => {
  test("name and phone are optional: now rounded up to 5 minutes, an hour, on the preselected seat", async () => {
    await mount();
    expect((screen.getByLabelText("reserve.seat") as HTMLSelectElement).value).toBe("10");
    await submit();
    expect(repo.reserve).toHaveBeenCalledWith(10, { minutes: 60, date: "2026-11-07", start_time: "15:05" });
    expect(toast).toHaveBeenCalledWith("success", "reserve.done");
    expect(onSaved).toHaveBeenCalled();
  });

  test("a slot clicked on the calendar is the start; another seat can be chosen", async () => {
    await mount({ kind: "create", placeId: 10, start: new Date(2026, 10, 9, 20, 15) });
    await type(screen.getByLabelText("reserve.seat"), "11");
    await submit();
    expect(repo.reserve).toHaveBeenCalledWith(11, { minutes: 60, date: "2026-11-09", start_time: "20:15" });
  });

  test("the phone is masked as typed and pasted, and sent as +374XXXXXXXX; the name is collapsed", async () => {
    await mount();
    await type(field("reserve.phone"), "077777");
    expect(field("reserve.phone").value).toBe("077 777");
    await type(field("reserve.phone"), "+374 77 123456");
    expect(field("reserve.phone").value).toBe("077 123 456");
    await type(field("reserve.name"), "  Aram   Petrosyan ");
    await submit();
    expect(repo.reserve).toHaveBeenCalledWith(10, expect.objectContaining({ name: "Aram Petrosyan", phone: "+37477123456" }));
  });

  test("a half-typed phone blocks the submit and, once left, says why", async () => {
    await mount();
    await type(field("reserve.phone"), "077 12");
    expect(confirmBtn().disabled).toBe(true);
    expect(screen.queryByText("reserve.phoneInvalid")).toBeNull();
    await act(async () => { fireEvent.blur(field("reserve.phone")); });
    expect(screen.getByText("reserve.phoneInvalid")).toBeTruthy();
    await type(field("reserve.phone"), "");
    expect(confirmBtn().disabled).toBe(false);
  });

  test("a name is empty, or at least 2 letters/spaces/'-. ; anything else is said and held", async () => {
    await mount();
    for (const bad of ["A", "Aram1", "@ram", "  ."]) {
      await type(field("reserve.name"), bad);
      expect(confirmBtn().disabled, bad).toBe(true);
      expect(screen.getByText("reserve.nameInvalid")).toBeTruthy();
    }
    for (const ok of ["", "Ар", "Արամ", "O'Neil-Smith Jr."]) {
      await type(field("reserve.name"), ok);
      expect(confirmBtn().disabled, ok).toBe(false);
    }
  });

  test("15 minutes to 5 hours: 5 h 30 is refused before sending", async () => {
    await mount();
    await type(screen.getByTestId("reserve-hold-hours"), "5");
    await type(screen.getByTestId("reserve-hold-minutes"), "30");
    expect(confirmBtn().disabled).toBe(true);
  });

  test("the server's refusal is shown in the form, which stays", async () => {
    repo.reserve.mockRejectedValue(new Error("This seat is already reserved at that time."));
    await mount();
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("This seat is already reserved at that time.");
    expect(screen.getByTestId("reserve-dialog")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("editing a reservation", () => {
  test("prefilled from the row; nothing changed means nothing to save", async () => {
    await mount({ kind: "edit", reservation: staffRow() });
    expect(field("reserve.name").value).toBe("Aram");
    expect(field("reserve.phone").value).toBe("077 777 777");
    expect(field("reserve.date").value).toBe("07.11.26");
    expect(confirmBtn().disabled).toBe(true);
  });

  test("a name or phone change is sent without asking; a cleared phone is sent as null", async () => {
    await mount({ kind: "edit", reservation: staffRow() });
    await type(field("reserve.name"), "Aram P.");
    await type(field("reserve.phone"), "");
    await submit();
    expect(confirmFn).not.toHaveBeenCalled();
    expect(repo.updateReservation).toHaveBeenCalledWith(77, { name: "Aram P.", phone: null });
    expect(toast).toHaveBeenCalledWith("success", "reserve.updated");
  });

  test("a new start asks first; No sends nothing, Yes sends only the start", async () => {
    await mount({ kind: "edit", reservation: staffRow() });
    await type(screen.getByTestId("reserve-start-hours"), "19");
    await type(screen.getByTestId("reserve-start-minutes"), "30");

    confirmFn.mockResolvedValueOnce(false);
    await submit();
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn.mock.calls[0][0]).toBe("reserve.moveConfirm");
    expect(repo.updateReservation).not.toHaveBeenCalled();

    await submit();
    expect(repo.updateReservation).toHaveBeenCalledWith(77, { start_time: "19:30" });
  });

  test("another seat or length is a move too", async () => {
    await mount({ kind: "edit", reservation: staffRow() });
    await type(screen.getByLabelText("reserve.seat"), "11");
    await type(screen.getByTestId("reserve-hold-hours"), "2");
    await submit();
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(repo.updateReservation).toHaveBeenCalledWith(77, { place_id: 11, minutes: 120 });
  });

  test("a refused move keeps the form and shows the server's sentence", async () => {
    repo.updateReservation.mockRejectedValue(new Error("Seat №5 is taken at 18:00."));
    await mount({ kind: "edit", reservation: staffRow() });
    await type(screen.getByLabelText("reserve.seat"), "11");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Seat №5 is taken at 18:00.");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
