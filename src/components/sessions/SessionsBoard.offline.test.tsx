// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import SessionsBoard from "./SessionsBoard";

/**
 * End-to-end (component level) proof of the user-reported bug:
 * a place whose computer is offline showed «Свободно» and its Start button
 * was clickable, so a session could be opened on an unreachable machine.
 *
 * Everything below the board is mocked to the thinnest possible stub — the
 * assertions are about what the CASHIER sees, not about the plumbing.
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
// Realtime + bookings are orthogonal to device availability here.
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
// Same reason as the line above: the board subscribes, and a real Echo client
// in jsdom reaches for `window.Pusher`.
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const pc = (over: Partial<IPcApi>): IPcApi => ({
  id: 1,
  branch_id: 7,
  place_id: 10,
  label: "Seat 1",
  kind: PC_KIND.Pc,
  status: PC_STATUS.Online,
  place: { id: 10, number: 1, name: "Seat 1", type: "standard", platform: "pc" },
  ...over,
});

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <SessionsBoard branchId={7} />
      </MemoryRouter>,
    );
  });
};

const startButton = () =>
  screen.getAllByRole("button").find((b) => b.textContent === "action.start") as HTMLButtonElement;

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset();
  repo.listActive.mockReset();
  repo.listActive.mockResolvedValue([]);
  localStorage.clear();
});

describe("SessionsBoard — device availability", () => {
  test("an offline computer is not shown as free and cannot be started", async () => {
    repo.listPcs.mockResolvedValue([pc({ status: PC_STATUS.Offline, is_startable: false })]);
    await mount();

    expect(screen.getByText("session.deviceOffline")).toBeTruthy();
    expect(screen.queryByText(/session\.free/)).toBeNull();
    expect(startButton().disabled).toBe(true);
  });

  test("an online computer keeps the free label and a working Start", async () => {
    repo.listPcs.mockResolvedValue([pc({ status: PC_STATUS.Online, is_startable: true })]);
    await mount();

    expect(screen.getByText(/session\.free/)).toBeTruthy();
    expect(screen.queryByText("session.deviceOffline")).toBeNull();
    expect(startButton().disabled).toBe(false);
  });

  test("a billing-only console stays startable even with a legacy offline row", async () => {
    repo.listPcs.mockResolvedValue([
      pc({
        kind: PC_KIND.Ps,
        status: PC_STATUS.Offline,
        place: { id: 10, number: 1, name: "PS5", type: "standard", platform: "ps5" },
      }),
    ]);
    await mount();

    expect(screen.queryByText("session.deviceOffline")).toBeNull();
    expect(startButton().disabled).toBe(false);
  });

  test("the server verdict wins over a stale status column", async () => {
    // Column says online, but the agent's heartbeat went stale server-side.
    repo.listPcs.mockResolvedValue([pc({ status: PC_STATUS.Online, is_startable: false })]);
    await mount();

    expect(screen.getByText("session.deviceOffline")).toBeTruthy();
    expect(startButton().disabled).toBe(true);
  });
});
