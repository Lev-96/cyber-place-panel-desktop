// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The live board's states (2026-10-07): an empty branch rendered NOTHING (a
 * blank area under the legend), and a failed first snapshot was a red line
 * with no way to try again although Refresh exists.
 */

const live = vi.hoisted(() => ({
  state: { snapshot: null as unknown, error: null as unknown, loading: true },
  refresh: vi.fn(),
}));
vi.mock("@/hooks/useRealtimeBranch", () => ({ useRealtimeBranch: () => ({ ...live.state, refresh: live.refresh }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("./StatusLegend", () => ({ default: () => <div>LEGEND</div> }));
vi.mock("./PlaceCell", () => ({ default: ({ snapshot }: { snapshot: { place: { id: number } } }) => <div className="cell">{`cell-${snapshot.place.id}`}</div> }));

import BranchLiveScreen from "./BranchLiveScreen";

const snapshot = (places: unknown[]) => ({ places, totals: {}, takenAt: new Date("2026-10-07T10:00:00Z") });

afterEach(() => cleanup());
beforeEach(() => { live.refresh.mockReset(); localStorage.clear(); });

describe("BranchLiveScreen — states", () => {
  test("before the first snapshot: the skeleton, never a blank page", async () => {
    live.state = { snapshot: null, error: null, loading: false };
    await act(async () => { render(<BranchLiveScreen branchId={7} />); });
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  test("a failed first snapshot: the error state, and Retry is the board's Refresh", async () => {
    live.state = { snapshot: null, error: new TypeError("Failed to fetch"), loading: false };
    await act(async () => { render(<BranchLiveScreen branchId={7} />); });

    expect(screen.getByText("state.offline.title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "action.retry" }));
    expect(live.refresh).toHaveBeenCalledTimes(1);
  });

  test("a branch with no places says so", async () => {
    live.state = { snapshot: snapshot([]), error: null, loading: false };
    await act(async () => { render(<BranchLiveScreen branchId={7} />); });

    expect(screen.getByText("live.state.emptyTitle")).toBeTruthy();
  });

  test("a failed refresh keeps the board, with a quiet notice", async () => {
    live.state = {
      snapshot: snapshot([{ place: { id: 3, platform: "pc" } }]),
      error: Object.assign(new Error("Server Error"), { status: 500 }),
      loading: false,
    };
    await act(async () => { render(<BranchLiveScreen branchId={7} />); });

    expect(screen.getByText("cell-3")).toBeTruthy();
    expect(screen.getByText("state.stale.failed")).toBeTruthy();
  });
});
