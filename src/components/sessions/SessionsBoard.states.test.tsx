// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import SessionsBoard from "./SessionsBoard";

/**
 * The board's loading / empty / error / offline states (2026-10-07).
 *
 * The bug: a dropped connection made `orFallback` resolve the device list as
 * `[]`, so the board said "No devices registered" and every running session
 * vanished from the floor. Now the read throws, the first load shows the
 * offline state with Retry, and a failed REFRESH keeps the seats on screen.
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
const availability = vi.hoisted(() => ({ handler: null as null | ((e: { reason: string }) => void) }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({
  usePlaceAvailability: (_b: unknown, onChange: (e: { reason: string }) => void) => { availability.handler = onChange; },
}));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const seat: IPcApi = {
  id: 1, branch_id: 7, place_id: 10, label: "Seat 1", kind: PC_KIND.Pc, status: PC_STATUS.Online,
  place: { id: 10, number: 1, name: "Seat 1", type: "standard", platform: "pc" },
};
const offline = () => new TypeError("Failed to fetch");

const mount = async () => {
  await act(async () => {
    render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>);
  });
};

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset();
  repo.listActive.mockReset();
  repo.listActive.mockResolvedValue([]);
  availability.handler = null;
  localStorage.clear();
});

describe("SessionsBoard — states", () => {
  test("offline on the first load: the offline state with Retry, NEVER «No devices registered»", async () => {
    repo.listPcs.mockRejectedValueOnce(offline()).mockResolvedValue([seat]);
    await mount();

    expect(screen.getByText("state.offline.title")).toBeTruthy();
    expect(screen.queryByText("session.state.noPcsTitle")).toBeNull();
    expect(screen.queryByText("Failed to fetch")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "action.retry" })); });
    expect(repo.listPcs).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("state.offline.title")).toBeNull();
    expect(document.querySelectorAll(".session-card").length).toBe(1);
  });

  test("a server error on the first load is the error state, not empty", async () => {
    repo.listPcs.mockRejectedValue(Object.assign(new Error("Server Error"), { status: 500, body: { message: "Server Error" } }));
    await mount();

    expect(screen.getByText("session.state.errorTitle")).toBeTruthy();
    expect(screen.queryByText("session.state.noPcsTitle")).toBeNull();
  });

  test("a failed REFRESH keeps the seats on screen, with a quiet notice", async () => {
    repo.listPcs.mockResolvedValue([seat]);
    await mount();
    expect(document.querySelectorAll(".session-card").length).toBe(1);

    repo.listActive.mockRejectedValue(offline());
    await act(async () => { availability.handler?.({ reason: "booking" }); });

    expect(document.querySelectorAll(".session-card").length).toBe(1);
    expect(screen.getByText("state.stale.offline")).toBeTruthy();
    expect(screen.queryByText("session.state.noPcsTitle")).toBeNull();
  });

  test("a branch with genuinely no devices says so", async () => {
    repo.listPcs.mockResolvedValue([]);
    await mount();

    expect(screen.getByText("session.state.noPcsTitle")).toBeTruthy();
    expect(screen.getByText("session.state.noPcsDescription")).toBeTruthy();
  });

  test("devices arriving after an empty board replace the empty state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      repo.listPcs.mockResolvedValueOnce([]).mockResolvedValue([seat]);
      await mount();
      expect(screen.getByText("session.state.noPcsTitle")).toBeTruthy();

      // The board's own 30 s poll re-reads the device list.
      await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });

      expect(screen.queryByText("session.state.noPcsTitle")).toBeNull();
      expect(document.querySelectorAll(".session-card").length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
