// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * Extra time not paid yet, on the board (2026-11-07, owner): the card's
 * switch, and the yellow warning — with its sound — when such a seat ends,
 * by itself or at any desk. The amount is always the server's.
 */

const repo = vi.hoisted(() => ({
  listPcs: vi.fn(), listActive: vi.fn(), setUnpaid: vi.fn(), preview: vi.fn(), stop: vi.fn(),
}));
const socket = vi.hoisted(() => ({ handler: null as null | ((e: unknown) => void) }));
const sound = vi.hoisted(() => ({ playFor: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    setUnpaid: (...a: unknown[]) => repo.setUnpaid(...a),
    preview: (...a: unknown[]) => repo.preview(...a),
    stop: (...a: unknown[]) => repo.stop(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/sound/soundEngine", async () => {
  const real = await vi.importActual<typeof import("@/sound/soundEngine")>("@/sound/soundEngine");
  return { ...real, playFor: (...a: unknown[]) => sound.playFor(...a) };
});
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({
  useSessionChanged: (_branch: number, h: (e: unknown) => void) => { socket.handler = h; },
}));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n}·AMD`, lang: "en" }),
}));

import SessionsBoard from "./SessionsBoard";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

const pc = (): IPcApi => ({
  id: 1, branch_id: 7, place_id: 10, label: "PC 1", kind: PC_KIND.Ps, status: PC_STATUS.InSession,
  place: { id: 10, number: 4, platform: "ps5", type: "standard", status: "active" },
} as unknown as IPcApi);

const running = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 5, pc_id: 1, branch_id: 7, status: "active", mode: "fixed",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  ends_at: new Date(Date.now() + 50 * 60_000).toISOString(),
  hourly_rate: 1000, total_paid: 0, committed_amount: 1000,
  items: [], joysticks: [], supports_joysticks: false, extra_item: null, paused_at: null, pauses: [],
  unpaid_since: null,
  ...over,
} as unknown as ISessionApi);

const mount = async () => {
  await act(async () => { render(<ConfirmProvider><MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter></ConfirmProvider>); });
};
const stopped = (over: Record<string, unknown> = {}) => ({
  kind: "stopped", session_id: 5, branch_id: 7, pc_id: 1, place_id: 10, status: "expired", mode: "fixed",
  is_free: false, is_unlimited: false, joystick_count: 1, ends_at: null, at: new Date().toISOString(), ...over,
});
const emit = async (e: unknown) => { await act(async () => { socket.handler?.(e); }); };

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([pc()]);
  repo.listActive.mockReset().mockResolvedValue([running()]);
  repo.setUnpaid.mockReset();
  repo.preview.mockReset().mockResolvedValue({ mode: "fixed", elapsed_minutes: 10, time_cost: 100, total: 100, items: [], items_total: 0, is_free: false });
  sound.playFor.mockReset();
  socket.handler = null;
});

describe("extra time not paid yet", () => {
  // The switch is in «+ Время» and Start only (2026-11-07, owner): never on
  // the card. Its logic is the dialogs' and their tests'.
  test("the card carries no «Не оплачено» switch, on or off", async () => {
    await mount();
    expect(screen.queryByRole("switch")).toBeNull();
    cleanup();
    repo.listActive.mockResolvedValue([running({ unpaid_since: new Date().toISOString() })]);
    await mount();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("a seat ending owing rings once and shows the seat and the server's amount", async () => {
    await mount();
    await emit(stopped({ unpaid: true, unpaid_amount: 500 }));

    expect(screen.getByTestId("unpaid-alert")).toBeTruthy();
    expect(screen.getByTestId("unpaid-alert-amount").textContent).toBe("500·AMD");
    expect(screen.getByTestId("unpaid-alert").querySelector(".unpaid-alert__seat")?.textContent).toBe("№4");
    expect(sound.playFor).toHaveBeenCalledTimes(1);
    expect(sound.playFor).toHaveBeenCalledWith("session_unpaid", "unpaid-5");

    // The same end heard twice (a retry, both sources): one warning, one ring.
    await emit(stopped({ unpaid: true, unpaid_amount: 500, status: "stopped" }));
    expect(sound.playFor).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.click(screen.getByTestId("unpaid-alert-ok")); });
    expect(screen.queryByTestId("unpaid-alert")).toBeNull();
  });

  test("nothing owed, or never switched on: no warning, no sound", async () => {
    await mount();
    await emit(stopped({ unpaid: true, unpaid_amount: 0 }));
    await emit(stopped({ session_id: 6, unpaid: false, unpaid_amount: null }));
    await emit(stopped({ session_id: 7 }));

    expect(screen.queryByTestId("unpaid-alert")).toBeNull();
    expect(sound.playFor).not.toHaveBeenCalled();
  });

  test("two seats ending owing are two warnings, the second waiting its turn", async () => {
    await mount();
    await emit(stopped({ session_id: 5, unpaid_amount: 500 }));
    await emit(stopped({ session_id: 8, unpaid_amount: 300 }));

    expect(screen.getByTestId("unpaid-alert-amount").textContent).toBe("500·AMD");
    expect(screen.getByText("session.unpaid.alertMore")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId("unpaid-alert-ok")); });
    expect(screen.getByTestId("unpaid-alert-amount").textContent).toBe("300·AMD");
    expect(sound.playFor).toHaveBeenCalledTimes(2);
  });
});
