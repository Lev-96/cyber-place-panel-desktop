// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/** Reserve a seat for a player who phoned (2026-11-07): what is sent, what is refused before sending. */

const repo = vi.hoisted(() => ({ reserve: vi.fn() }));
vi.mock("@/repositories/BookingRepository", () => ({ bookingRepository: { reserve: (...a: unknown[]) => repo.reserve(...a) } }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }) }));

import ReserveSeatDialog from "./ReserveSeatDialog";

const onReserved = vi.fn();
const mount = async () => {
  await act(async () => { render(<ReserveSeatDialog placeId={10} seat="№4" onClose={() => {}} onReserved={onReserved} />); });
};
const type = async (label: string, value: string) => {
  await act(async () => { fireEvent.change(screen.getByLabelText(label), { target: { value } }); });
};
const confirm = () => screen.getByTestId("reserve-confirm") as HTMLButtonElement;

beforeEach(() => { repo.reserve.mockReset(); onReserved.mockReset(); });
afterEach(cleanup);

describe("reserving a seat", () => {
  test("a name and a phone, held an hour by default: sent as typed", async () => {
    repo.reserve.mockResolvedValue({});
    await mount();
    expect(confirm().disabled).toBe(true);

    await type("reserve.name", "  Aram ");
    await type("reserve.phone", "+374 91 123456");
    await act(async () => { fireEvent.click(confirm()); });

    expect(repo.reserve).toHaveBeenCalledWith(10, { name: "Aram", phone: "+374 91 123456", minutes: 60 });
    expect(onReserved).toHaveBeenCalled();
  });

  test("no phone is fine; a phone that is not one holds the confirm", async () => {
    repo.reserve.mockResolvedValue({});
    await mount();
    await type("reserve.name", "Aram");
    await type("reserve.phone", "call me");
    expect(confirm().disabled).toBe(true);
    expect(screen.getByText("reserve.phoneInvalid")).toBeTruthy();

    await type("reserve.phone", "");
    await act(async () => { fireEvent.click(confirm()); });
    expect(repo.reserve).toHaveBeenCalledWith(10, { name: "Aram", minutes: 60 });
  });

  test("the hold is the start dialog's time field: 1 h 30 is 90 minutes; under 15 minutes is refused", async () => {
    repo.reserve.mockResolvedValue({});
    await mount();
    await type("reserve.name", "Aram");
    await act(async () => { fireEvent.change(screen.getByTestId("reserve-hold-minutes"), { target: { value: "30" } }); });
    await act(async () => { fireEvent.click(confirm()); });
    expect(repo.reserve).toHaveBeenLastCalledWith(10, { name: "Aram", minutes: 90 });

    await act(async () => { fireEvent.change(screen.getByTestId("reserve-hold-hours"), { target: { value: "0" } }); });
    await act(async () => { fireEvent.change(screen.getByTestId("reserve-hold-minutes"), { target: { value: "10" } }); });
    expect(confirm().disabled).toBe(true);
  });

  test("the server's refusal is shown and the dialog stays", async () => {
    repo.reserve.mockRejectedValue(new Error("This place is already booked."));
    await mount();
    await type("reserve.name", "Aram");
    await act(async () => { fireEvent.click(confirm()); });

    expect(screen.getByText("This place is already booked.")).toBeTruthy();
    expect(onReserved).not.toHaveBeenCalled();
  });
});
