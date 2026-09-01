// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import SessionsBoard from "./SessionsBoard";

/**
 * The console's own power, in the seat's card.
 *
 * It is a different thing from Start and Stop and has to stay one: it opens no
 * session and bills nothing. The rules it has to obey are about where it may
 * appear at all — a PC has no console to power, and a seat with somebody
 * playing on it must not offer to put their console to sleep, because a running
 * session outranks everything in the state machine and the console would be
 * woken again within seconds.
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
const api = vi.hoisted(() => ({ power: vi.fn() }));
const control = vi.hoisted(() => ({
  powering: vi.fn(),
  statuses: {} as Record<string, { state: string; address: string | null; name: string | null }>,
}));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/api/pcs", () => ({ apiSetConsolePower: (...a: unknown[]) => api.power(...a) }));
vi.mock("@/ps5/Ps5ControlProvider", () => ({
  usePs5Control: () => ({
    views: {},
    statuses: control.statuses,
    sessionStarting: vi.fn(),
    sessionStopped: vi.fn(),
    powering: control.powering,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const HOST = "5C9666876D85";

const console_ = (over: Partial<IPcApi> = {}): IPcApi => ({
  id: 1,
  branch_id: 7,
  place_id: 10,
  label: "PS5 №1",
  kind: PC_KIND.Ps,
  status: PC_STATUS.Online,
  is_startable: true,
  console_host_id: HOST,
  console_address: "192.168.1.35",
  place: { id: 10, number: 1, name: "PS5 №1", type: "standard", platform: "ps5" },
  ...over,
} as IPcApi);

const computer = (): IPcApi => ({
  id: 2,
  branch_id: 7,
  place_id: 11,
  label: "PC №1",
  kind: PC_KIND.Pc,
  status: PC_STATUS.Online,
  is_startable: true,
  place: { id: 11, number: 2, name: "PC №1", type: "standard", platform: "pc" },
} as IPcApi);

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <SessionsBoard branchId={7} />
      </MemoryRouter>,
    );
  });
};

const powerButton = () =>
  screen.getAllByRole("button").find((b) =>
    b.textContent === "ps5.power.on" || b.textContent === "ps5.power.off") as HTMLButtonElement | undefined;

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset();
  repo.listActive.mockReset();
  repo.listActive.mockResolvedValue([]);
  api.power.mockReset();
  api.power.mockResolvedValue({ pc: {} });
  control.powering.mockReset();
  control.statuses = {};
  localStorage.clear();
});

describe("the console's own power button", () => {
  test("a resting console offers to be turned on", async () => {
    control.statuses = { [HOST]: { state: "rest", address: "192.168.1.35", name: "PS5-172" } };
    repo.listPcs.mockResolvedValue([console_()]);
    await mount();

    expect(powerButton()?.textContent).toBe("ps5.power.on");
  });

  test("an awake console offers rest mode — never a promise of off", async () => {
    // The protocol has no shutdown. Saying "off" on a button would be a promise
    // the hardware cannot keep, so the wording is the state it can reach.
    control.statuses = { [HOST]: { state: "awake", address: "192.168.1.35", name: "PS5-172" } };
    repo.listPcs.mockResolvedValue([console_()]);
    await mount();

    expect(powerButton()?.textContent).toBe("ps5.power.off");
  });

  test("a computer is not offered one at all", async () => {
    // A PC's power belongs to the kiosk agent, and nothing here touches it.
    control.statuses = { [HOST]: { state: "rest", address: null, name: null } };
    repo.listPcs.mockResolvedValue([computer()]);
    await mount();

    expect(powerButton()).toBeUndefined();
  });

  test("a console the panel has never heard from is not offered one either", async () => {
    // No observation means no honest state to act on.
    control.statuses = {};
    repo.listPcs.mockResolvedValue([console_()]);
    await mount();

    expect(powerButton()).toBeUndefined();
  });

  test("a seat with somebody playing on it has no power button", async () => {
    // A running session outranks everything: a console rested under one is woken
    // again within seconds, so the button would do nothing and look broken.
    control.statuses = { [HOST]: { state: "awake", address: "192.168.1.35", name: "PS5-172" } };
    repo.listPcs.mockResolvedValue([console_()]);
    repo.listActive.mockResolvedValue([
      { id: 5, pc_id: 1, branch_id: 7, status: "active", mode: "open", hourly_rate: "1500.00", started_at: new Date().toISOString(), items: [] },
    ]);
    await mount();

    expect(powerButton()).toBeUndefined();
  });

  test("pressing it tells the server and this machine, in that order", async () => {
    // The server records the venue's standing permission — every panel reads it
    // — and this machine sends the datagram, because only a panel on the venue's
    // LAN can reach a console.
    control.statuses = { [HOST]: { state: "rest", address: "192.168.1.35", name: "PS5-172" } };
    repo.listPcs.mockResolvedValue([console_()]);
    await mount();

    await act(async () => { fireEvent.click(powerButton()!); });

    expect(api.power).toHaveBeenCalledWith(1, "on");
    expect(control.powering).toHaveBeenCalledWith(1, true);
  });

  test("a refused command does not tell this machine to expect anything", async () => {
    // If the venue's permission was not recorded, acting as though it had been
    // is how a screen starts disagreeing with the room.
    control.statuses = { [HOST]: { state: "rest", address: "192.168.1.35", name: "PS5-172" } };
    repo.listPcs.mockResolvedValue([console_()]);
    api.power.mockRejectedValue(new Error("403"));
    await mount();

    await act(async () => { fireEvent.click(powerButton()!); });

    expect(control.powering).not.toHaveBeenCalled();
  });
});
