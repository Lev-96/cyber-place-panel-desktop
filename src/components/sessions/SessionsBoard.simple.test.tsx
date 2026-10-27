// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * The Simple interface on the sessions board (2026-10-27): the card shows its
 * main actions, and every other one is one press away under «Ещё» — the SAME
 * action, running the same handler, not a copy and not a loss.
 */
const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn(), pause: vi.fn() }));
const ui = vi.hoisted(() => ({ quick: "primary" as "primary" | "all" }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    pause: (...a: unknown[]) => repo.pause(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/preferences/UiPreferencesContext", () => ({
  useUiPreferencesOptional: () => ({ layout: { quick_actions: ui.quick } }),
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/repositories/JoystickPriceRepository", () => ({ joystickPriceRepository: { listByBranch: () => Promise.resolve([]) } }));
vi.mock("@/repositories/BillingSettingsRepository", () => ({
  billingSettingsRepository: { get: () => Promise.resolve({ branch_id: 7, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 0, joystick_included: 2, joystick_charged_slots: null, joystick_pricing_mode: "fixed" }) },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }) }));

import SessionsBoard from "./SessionsBoard";

const device: IPcApi = {
  id: 1, branch_id: 7, place_id: 10, label: "PC-1", kind: PC_KIND.Pc, status: PC_STATUS.InSession, is_startable: true,
  place: { id: 10, number: 1, name: "", type: "standard", platform: "pc" },
} as IPcApi;
const running = {
  id: 42, branch_id: 7, pc_id: 1, pc_label: "PC-1", mode: "fixed", status: "active",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(), ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  hourly_rate: 1000, committed_amount: 1000, total_paid: 0, is_free: false, paused_at: null,
} as ISessionApi;

const mount = async () => {
  await act(async () => {
    render(<ConfirmProvider><MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter></ConfirmProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

beforeEach(() => {
  repo.listPcs.mockResolvedValue([device]);
  repo.listActive.mockResolvedValue([running]);
  repo.pause.mockResolvedValue({ ...running, paused_at: new Date().toISOString() });
  ui.quick = "primary";
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("the Simple interface on the board", () => {
  test("the main actions are on the card; the rest wait under «Ещё»", async () => {
    await mount();
    expect(screen.getByRole("button", { name: "session.addItem" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "action.stop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.pause" })).toBeNull();
    expect(screen.queryByRole("button", { name: "session.addTime" })).toBeNull();
    expect(screen.queryByRole("button", { name: "session.relocate" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "session.card.more" }));
    expect(screen.getByRole("button", { name: "session.pause" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "session.addTime" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "session.relocate" })).toBeTruthy();
  });

  test("an action from «Ещё» is the real one: pausing pauses this session", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "session.card.more" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "session.pause" })); });
    expect(repo.pause).toHaveBeenCalledWith(42);
  });

  test("every other interface shows every action, with no «Ещё»", async () => {
    ui.quick = "all";
    await mount();
    expect(screen.getByRole("button", { name: "session.pause" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "session.card.more" })).toBeNull();
  });
});
