// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IBillBreakdown } from "@/api/sessions";
import { ISessionApi } from "@/types/sessions";
import StopReceiptModal from "./StopReceiptModal";

/**
 * What the closing receipt is allowed to say about money.
 *
 * A waived session used to print the venue's rate and the arithmetic the clock
 * would have earned — "1 000/h", "17.22" — directly above the words "Free
 * session". Two numbers and a word, only one of which the player is being
 * handed, and a cashier reading the receipt had to work out which.
 *
 * So on a waived bill the rate and the time cost are gone. What stays is the
 * time played, because how long the seat ran is a fact about the seat rather
 * than a charge, and the total, which says the words.
 *
 * The flag is `is_free` and nothing else. `total === 0` is equally true of a
 * paying session stopped in its first seconds, and deciding this from the
 * figure would waive that one on screen.
 */

const repo = vi.hoisted(() => ({ preview: vi.fn(), stop: vi.fn(), removeItem: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    preview: (...a: unknown[]) => repo.preview(...a),
    stop: (...a: unknown[]) => repo.stop(...a),
    removeItem: (...a: unknown[]) => repo.removeItem(...a),
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => k,
    // Distinctive enough that a match cannot come from anywhere else on screen.
    money: (n: number) => `${Number(n).toFixed(2)}·AMD`,
  }),
}));

const bill = (over: Partial<IBillBreakdown> = {}): IBillBreakdown => ({
  mode: "open",
  is_free: false,
  is_unlimited: true,
  elapsed_minutes: 1,
  time_cost: 17.22,
  hourly_rate: 1000,
  package_name: null,
  items: [],
  items_total: 0,
  joysticks: [],
  joysticks_total: 0,
  subtotal: 17.22,
  gross_total: 17.22,
  total: 17.22,
  ...over,
} as IBillBreakdown);

const session = { id: 1, pc_id: 8, pc_label: "PS4-08" } as ISessionApi;

const mount = async () => {
  await act(async () => {
    render(
      <StopReceiptModal
        session={session}
        onClose={() => {}}
        onConfirmed={() => {}}
        onItemRemoved={() => {}}
      />,
    );
  });
};

describe("StopReceiptModal", () => {
  beforeEach(() => {
    repo.preview.mockReset();
    repo.stop.mockReset();
  });
  afterEach(cleanup);

  test("a waived bill quotes no rate and no time cost", async () => {
    repo.preview.mockResolvedValue(bill({ is_free: true, total: 0 }));
    await mount();

    // Kept: the seat, the time played, the words.
    expect(screen.getByText(/PS4-08/)).toBeTruthy();
    expect(screen.getByText(/session\.timePlayed/)).toBeTruthy();
    expect(screen.getByText("session.totalDue")).toBeTruthy();
    expect(screen.getByText("session.freeBill")).toBeTruthy();

    // Gone: the rate, the arithmetic, and the "waived" line under the total.
    expect(screen.queryByText(/1000\.00·AMD/)).toBeNull();
    expect(screen.queryByText(/17\.22·AMD/)).toBeNull();
    expect(screen.queryByText(/session\.freeBillWaived/)).toBeNull();
  });

  test("an ordinary bill still quotes both", async () => {
    repo.preview.mockResolvedValue(bill());
    await mount();

    expect(screen.getByText(/1000\.00·AMD/)).toBeTruthy();
    // Twice: once as the time cost, once as the total.
    expect(screen.getAllByText(/17\.22·AMD/).length).toBe(2);
    expect(screen.queryByText("session.freeBill")).toBeNull();
  });

  /**
   * The case that makes `is_free` the right flag and `total === 0` the wrong
   * one: a paying session stopped in its first seconds owes nothing yet, and
   * must still show the rate it is running at.
   */
  test("a paying session that has earned nothing yet is not treated as waived", async () => {
    repo.preview.mockResolvedValue(bill({ time_cost: 0, subtotal: 0, gross_total: 0, total: 0 }));
    await mount();

    expect(screen.getByText(/1000\.00·AMD/)).toBeTruthy();
    expect(screen.queryByText("session.freeBill")).toBeNull();
  });
});
