// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import SessionTimer from "./SessionTimer";

/**
 * A paused tile's clock holds still — from the SERVER's instants, so a reload
 * or a dropped socket shows the same frozen figure — and a count-up clock
 * shows time PLAYED, which is what the bill charges for.
 */
describe("SessionTimer while paused", () => {
  const NOW = Date.parse("2026-09-23T14:50:00.000Z");
  const iso = (ms: number) => new Date(ms).toISOString();
  const min = 60_000;
  const money = (n: number) => `${Math.round(n)}·AMD`;

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const fixed = (over: Partial<ISessionApi> = {}): ISessionApi => ({
    mode: "fixed",
    started_at: iso(NOW - 50 * min),
    ends_at: iso(NOW + 10 * min),
    hourly_rate: null,
    committed_amount: 1500,
    total_paid: 1500,
    is_free: false,
    time_package: { duration_minutes: 60, price: 1500 },
    ...over,
  } as ISessionApi);

  test("the countdown stops at what was left when it was paused", async () => {
    // Paused 20 minutes ago with 30 left.
    const pausedAt = iso(NOW - 20 * min);
    render(<SessionTimer session={fixed({ paused_at: pausedAt, pauses: [{ paused_at: pausedAt, resumed_at: null }] })} formatMoney={money} />);

    expect(screen.getByText(/30:00/)).toBeTruthy();
    expect(screen.getByText("750·AMD")).toBeTruthy();

    await act(async () => { await vi.advanceTimersByTimeAsync(5 * min); });

    // Five more minutes of wall time: nothing moved.
    expect(screen.getByText(/30:00/)).toBeTruthy();
    expect(screen.getByText("750·AMD")).toBeTruthy();
    expect(screen.getByText("⏸")).toBeTruthy();
  });

  test("a running countdown still counts down", async () => {
    render(<SessionTimer session={fixed()} formatMoney={money} />);

    expect(screen.getByText(/10:00/)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(min); });
    expect(screen.getByText(/09:00/)).toBeTruthy();
    expect(screen.queryByText("⏸")).toBeNull();
  });

  test("a count-up clock shows time played, not time since the start", () => {
    const session = fixed({
      mode: "open", ends_at: null, hourly_rate: 1200,
      // Started 50 minutes ago, 20 of them paused.
      pauses: [{ paused_at: iso(NOW - 40 * min), resumed_at: iso(NOW - 20 * min) }],
    });
    render(<SessionTimer session={session} formatMoney={money} />);

    expect(screen.getByText(/▲ 30:00/)).toBeTruthy();
    expect(screen.getByText("600·AMD")).toBeTruthy();
  });
});
