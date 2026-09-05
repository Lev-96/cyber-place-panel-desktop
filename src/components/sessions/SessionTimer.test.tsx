// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import SessionTimer from "./SessionTimer";

/**
 * The clock and the money are two different questions, and this file exists
 * because the tile used to answer them with one.
 *
 * A waived session showed its cost ticking up at the venue's hourly rate —
 * beside a "Free" pill that said the opposite. Both cannot be true, and the
 * wrong half to stop is the clock: how long a seat has been in play is a fact
 * the floor needs whoever is paying for it, and an operator who cannot see it
 * cannot tell a machine that has been running five hours from one somebody
 * started a minute ago.
 *
 * So the timer runs identically for every session and only the amount knows
 * what free means.
 */
describe("SessionTimer", () => {
  afterEach(cleanup);

  const startedFiveHoursAgo = new Date(Date.now() - 5 * 3_600_000).toISOString();
  // Rounds like the real formatter does — the component hands it a raw float
  // and a few milliseconds of test runtime would otherwise show up as digits.
  const money = (n: number) => `${Math.round(n)} AMD`;

  test("a paying open session shows the clock and what it has earned", () => {
    render(
      <SessionTimer startedAt={startedFiveHoursAgo} endsAt={null} hourlyRate={1000} formatMoney={money} />,
    );

    expect(screen.getByText(/▲ 05:00/)).toBeTruthy();
    // Five hours at 1000 — the figure a waived session must not show.
    expect(screen.getByText("5000 AMD")).toBeTruthy();
  });

  test("a free session shows the same clock and nothing owed", () => {
    render(
      <SessionTimer
        startedAt={startedFiveHoursAgo}
        endsAt={null}
        hourlyRate={1000}
        isFree
        formatMoney={money}
      />,
    );

    // The clock is untouched: the timer was not stopped to stop the money.
    expect(screen.getByText(/▲ 05:00/)).toBeTruthy();
    expect(screen.getByText("0 AMD")).toBeTruthy();
    expect(screen.queryByText("5000 AMD")).toBeNull();
  });

  test("a free session says 0 rather than saying nothing", () => {
    // A session with no rate configured renders no amount at all, which is
    // right for a paying one — there is nothing to quote. A free session is a
    // decision somebody made, so it states the zero.
    render(<SessionTimer startedAt={startedFiveHoursAgo} endsAt={null} isFree formatMoney={money} />);

    expect(screen.getByText("0 AMD")).toBeTruthy();
  });

  test("a fixed-package session still counts down and quotes no money", () => {
    const endsInAnHour = new Date(Date.now() + 3_600_000).toISOString();
    render(<SessionTimer endsAt={endsInAnHour} startedAt={startedFiveHoursAgo} hourlyRate={1000} formatMoney={money} />);

    // Unchanged by any of the above: the countdown branch never showed money.
    expect(screen.queryByText(/▲/)).toBeNull();
    expect(screen.queryByText(/AMD/)).toBeNull();
  });
});
