// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import SessionTimer from "./SessionTimer";

/**
 * The clock and the money are two different questions, and the tile used to get
 * the second one wrong in two different ways.
 *
 * A WAIVED session showed its cost ticking up at the venue's rate, beside a
 * "Free" pill saying the opposite. A FIXED-PACKAGE session showed no amount at
 * all: the countdown branch rendered a clock and nothing else, so a cashier
 * could not see what the seat was worth without opening the stop receipt.
 *
 * The clock is the wrong half to change in either case — how long a seat has
 * been in play is a fact the floor needs whoever is paying for it — so it runs
 * identically for every session and only the amount knows what mode it is in.
 */
describe("SessionTimer", () => {
  afterEach(cleanup);

  const startedFiveHoursAgo = new Date(Date.now() - 5 * 3_600_000).toISOString();
  // Rounds like the real formatter does — the component hands it a raw number
  // and a few milliseconds of test runtime would otherwise show up as digits.
  const money = (n: number) => `${Math.round(n)}·AMD`;

  const open = (over: Partial<ISessionApi> = {}): ISessionApi => ({
    mode: "open",
    started_at: startedFiveHoursAgo,
    ends_at: null,
    hourly_rate: 1000,
    total_paid: 0,
    is_free: false,
    ...over,
  } as ISessionApi);

  /** A package bought up front: 1 hour for 1500, still 30 minutes to run. */
  const fixed = (over: Partial<ISessionApi> = {}): ISessionApi => ({
    mode: "fixed",
    started_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    hourly_rate: null,
    committed_amount: 1500,
    total_paid: 1500,
    is_free: false,
    // The tariff the hourly rate is derived from: 1500 per 60 minutes is
    // 1500/hour. Without it these would price through the no-tariff fallback
    // and pass for the wrong reason.
    time_package: { duration_minutes: 60, price: 1500 },
    ...over,
  } as ISessionApi);

  test("a paying open session shows the clock and what it has earned", () => {
    render(<SessionTimer session={open()} formatMoney={money} />);

    expect(screen.getByText(/▲ 05:00/)).toBeTruthy();
    expect(screen.getByText("5000·AMD")).toBeTruthy();
  });

  test("a free session shows the same clock and nothing owed", () => {
    render(<SessionTimer session={open({ is_free: true })} formatMoney={money} />);

    // The clock is untouched: the timer was not stopped to stop the money.
    expect(screen.getByText(/▲ 05:00/)).toBeTruthy();
    expect(screen.getByText("0·AMD")).toBeTruthy();
    expect(screen.queryByText("5000·AMD")).toBeNull();
  });

  test("a free session says 0 rather than saying nothing", () => {
    // A session with no rate configured quotes nothing, which is right for a
    // paying one — there is nothing to quote. A free session is a decision
    // somebody made, so it states the zero.
    render(<SessionTimer session={open({ hourly_rate: null, is_free: true })} formatMoney={money} />);

    expect(screen.getByText("0·AMD")).toBeTruthy();
  });

  test("an open session on a seat with no rate quotes nothing", () => {
    render(<SessionTimer session={open({ hourly_rate: null })} formatMoney={money} />);

    expect(screen.getByText(/▲ 05:00/)).toBeTruthy();
    expect(screen.queryByText(/AMD/)).toBeNull();
  });

  // ── the fixed package, which showed no money at all ──────────────────

  test("a fixed tariff counts down AND says what the seat is worth so far", () => {
    render(<SessionTimer session={fixed()} formatMoney={money} />);

    // Counting down to the auto-lock, which is what a fixed tariff needs. A
    // few milliseconds of test runtime put it just under the half hour.
    expect(screen.getByText(/^(29:5\d|30:00)$/)).toBeTruthy();
    // …and half an hour of a 1500/hour tariff is 750, not 1500.
    expect(screen.getByText("750·AMD")).toBeTruthy();
  });

  test("a fixed tariff ticks — it is an hourly rate with an auto-stop", () => {
    // Five minutes in and half an hour in must NOT read the same. This
    // reversed on 2026-09-06; before it, a package was owed in full from its
    // first second and both of these read 1500.
    const { unmount } = render(<SessionTimer session={fixed()} formatMoney={money} />);
    expect(screen.getByText("750·AMD")).toBeTruthy();
    unmount();

    render(<SessionTimer
      session={fixed({ started_at: new Date(Date.now() - 5 * 60_000).toISOString() })}
      formatMoney={money}
    />);
    expect(screen.getByText("125·AMD")).toBeTruthy();
  });

  test("a waived package is worth nothing, block or no block", () => {
    render(<SessionTimer session={fixed({ is_free: true })} formatMoney={money} />);

    expect(screen.getByText("0·AMD")).toBeTruthy();
    expect(screen.queryByText("1500·AMD")).toBeNull();
  });

  test("with no tariff to price from it falls back to what was committed", () => {
    // A package row deleted under a running session. `total_paid` is the
    // second fallback, for rows that closed before `committed_amount` existed
    // — the same ladder the backend uses, for the same rows.
    render(<SessionTimer
      session={fixed({ time_package: null, committed_amount: undefined })}
      formatMoney={money}
    />);

    expect(screen.getByText("1500·AMD")).toBeTruthy();
  });

  // ── unlimited: the sold block plus the overflow past it ──────────────

  test("an unlimited session bills the block plus what ran past it", () => {
    render(<SessionTimer
      session={fixed({
        ends_at: null,
        unlimited_at: new Date(Date.now() - 90 * 60_000).toISOString(),
        // The block ran out an hour ago; the rate applies only after that.
        committed_until: new Date(Date.now() - 3_600_000).toISOString(),
        hourly_rate: 1500,
        started_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      })}
      formatMoney={money}
    />);

    // 1500 sold + one hour of overflow at 1500 — never two hours from the start.
    expect(screen.getByText("3000·AMD")).toBeTruthy();
  });

  test("a session made unlimited mid-block is not charged the whole block", () => {
    // Half an hour played, the end removed a minute ago. Until 2026-09-06 this
    // read a flat 1500 — the block was treated as sold. It is 750: the minutes
    // played, at the tariff's rate. The row is the shape the server writes on
    // the switch: `committed_until` = the switch instant and
    // `committed_amount` = what 29 minutes had earned (725), then one minute
    // more at the same rate.
    render(<SessionTimer
      session={fixed({
        ends_at: null,
        unlimited_at: new Date(Date.now() - 60_000).toISOString(),
        committed_until: new Date(Date.now() - 60_000).toISOString(),
        committed_amount: 725,
        hourly_rate: 1500,
      })}
      formatMoney={money}
    />);

    expect(screen.getByText("750·AMD")).toBeTruthy();
  });
});
