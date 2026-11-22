// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import SessionTimer from "./SessionTimer";

/**
 * Time stops at once (2026-11-22, owner), on screen only: a countdown that
 * reached 0 says «Время вышло» and its money holds at the end; a seat whose
 * Stop is being settled holds its clock and money at the press. Nothing here
 * is sent anywhere — the server prices as before.
 */
describe("SessionTimer — the clock stops at once", () => {
  afterEach(cleanup);
  const money = (n: number) => `${n.toFixed(2)}·AMD`;

  /** 1000/h, one hour bought, `endedMinAgo` past its end (still active: the sweep has not run). */
  const ranOut = (endedMinAgo: number): ISessionApi => ({
    mode: "open", status: "active", is_free: false, total_paid: 0,
    started_at: new Date(Date.now() - (60 + endedMinAgo) * 60_000).toISOString(),
    ends_at: new Date(Date.now() - endedMinAgo * 60_000).toISOString(),
    hourly_rate: 1000,
  } as ISessionApi);

  test("a countdown at 0 says time's up and its money holds at the end", () => {
    render(<SessionTimer session={ranOut(5)} formatMoney={money} timeUpLabel="TIME UP" />);
    expect(screen.getByTestId("time-up").textContent).toBe("TIME UP");
    // One hour at 1000 — not 1083.33 for the five minutes past the end.
    expect(screen.getByText("1000.00·AMD")).toBeTruthy();
  });

  test("without the label it still holds at 00:00 (the card in the interface preview)", () => {
    const { container } = render(<SessionTimer session={ranOut(5)} formatMoney={money} />);
    expect(container.textContent).toContain("00:00");
  });

  test("still running: no time's-up", () => {
    const running = { ...ranOut(0), ends_at: new Date(Date.now() + 10 * 60_000).toISOString() } as ISessionApi;
    render(<SessionTimer session={running} formatMoney={money} timeUpLabel="TIME UP" />);
    expect(screen.queryByTestId("time-up")).toBeNull();
  });

  test("at checkout the count-up clock and the money hold at the press", () => {
    // One instant for both, so the hour at the press is exactly 60:00 (two
    // reads of the clock a millisecond apart showed 59:59 under load).
    const now = Date.now();
    const pressed = now - 30 * 60_000;
    const openSeat = {
      mode: "open", status: "active", is_free: false, total_paid: 0, hourly_rate: 1000, ends_at: null,
      started_at: new Date(now - 90 * 60_000).toISOString(),
    } as ISessionApi;
    const { container } = render(<SessionTimer session={openSeat} formatMoney={money} frozenAt={pressed} checkoutLabel="AT CHECKOUT" />);
    const clock = container.querySelector("[data-frozen]") as HTMLElement;
    expect(clock.getAttribute("title")).toBe("AT CHECKOUT");
    // 60 minutes played at the press, not 90.
    expect(clock.textContent).toContain("01:00:00");
    expect(screen.getByText("1000.00·AMD")).toBeTruthy();
  });

  test("a countdown at checkout holds where it was, never «time's up»", () => {
    const pressed = Date.now() - 10 * 60_000;
    const { container } = render(<SessionTimer session={ranOut(5)} formatMoney={money} frozenAt={pressed} timeUpLabel="TIME UP" />);
    expect(screen.queryByTestId("time-up")).toBeNull();
    // Pressed 5 minutes before the end.
    expect(container.querySelector("[data-frozen]")?.textContent).toContain("05:00");
  });
});
