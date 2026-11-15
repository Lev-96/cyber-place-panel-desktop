// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MoneyFormatOptions } from "@/i18n/currency";
import { ISessionApi } from "@/types/sessions";
import SessionTimer from "./SessionTimer";

/**
 * The card prints the cents the server stores (2026-11-16, billing audit
 * «Tile»): a branch that does not round (step 0) bills 1 249.99 for two pads
 * at 37:33 — printed in whole drams the card read "1 250" against a receipt
 * of 1 249.99. Cents exactly when the figure has them; a whole figure (any
 * branch with a step) prints none, as before.
 */
describe("SessionTimer — the cents the bill has", () => {
  // One frozen instant: the figure must not move by a second mid-test.
  const NOW = Date.parse("2026-11-16T12:00:00Z");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // The formatter's own contract: the digits it is asked for, nothing more.
  const money = (n: number, options?: MoneyFormatOptions) =>
    `${n.toFixed(options?.minimumFractionDigits ?? 0)}·AMD`;

  /** A count-up seat at 833.33/h, 1 h 30 min played: 1249.995 → 1250.00 on the receipt. */
  const seat = (over: Partial<ISessionApi>): ISessionApi => ({
    mode: "open",
    status: "active",
    started_at: new Date(NOW - 5400_000).toISOString(),
    ends_at: null,
    hourly_rate: "833.33",
    total_paid: 0,
    is_free: false,
    rounding_step: 0,
    rounding_mode: "up",
    ...over,
  } as ISessionApi);

  test("a figure with cents is printed with them", () => {
    // 833.34/h for 5400 s = 1250.01.
    render(<SessionTimer session={seat({ hourly_rate: "833.34" })} formatMoney={money} />);
    expect(screen.getByText("1250.01·AMD")).toBeTruthy();
  });

  test("a whole figure is printed whole", () => {
    // 833.33 × 1.5 = 1249.995 → 1250.00 exactly as the server rounds it.
    render(<SessionTimer session={seat({})} formatMoney={money} />);
    expect(screen.getByText("1250·AMD")).toBeTruthy();
  });

  test("a branch rounding to a step shows the step", () => {
    render(<SessionTimer session={seat({ hourly_rate: "833.34", rounding_step: 100, rounding_mode: "nearest" })} formatMoney={money} />);
    expect(screen.getByText("1300·AMD")).toBeTruthy();
  });
});
