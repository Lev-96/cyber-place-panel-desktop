// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import type { MachineState } from "@/ps5/machine";

/**
 * A PlayStation seat's Start and Stop while its console changes state
 * (2026-10-19, the owner's rule): no second press while the console is still on
 * its way, and the button says where it is going.
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
const ps5 = vi.hoisted(() => ({ state: undefined as MachineState | undefined }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));
vi.mock("@/ps5/Ps5ControlProvider", () => ({
  usePs5Control: () => ({
    views: ps5.state ? { HOST1: { snapshot: { state: ps5.state, desired: "active", error: null }, pending: null } } : {},
    statuses: ps5.state ? { HOST1: { state: ps5.state === "ACTIVE" ? "awake" : "rest", address: "192.168.1.35", name: "PS5" } } : {},
    sessionStarting: () => {},
    sessionStopped: () => {},
    credentialsChanged: () => {},
  }),
}));

import SessionsBoard from "./SessionsBoard";

const seat = (): IPcApi => ({
  id: 1, branch_id: 7, place_id: 10, label: "PS5", kind: PC_KIND.Ps, status: PC_STATUS.Online, is_startable: true,
  console_host_id: "HOST1", console_address: "192.168.1.35",
  place: { id: 10, number: 9, name: "PS5", type: "standard", platform: "ps5" },
} as unknown as IPcApi);

const running = (): ISessionApi => ({
  id: 5, pc_id: 1, branch_id: 7, status: "active", mode: "fixed",
  started_at: new Date(Date.now() - 60_000).toISOString(),
  ends_at: new Date(Date.now() + 59 * 60_000).toISOString(),
  hourly_rate: null, total_paid: 1500, committed_amount: 1500,
  time_package: { duration_minutes: 60, price: 1500 },
  items: [], joysticks: [], supports_joysticks: false, extra_item: null, paused_at: null, pauses: [],
} as unknown as ISessionApi);

const mount = async () => {
  await act(async () => {
    render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>);
  });
};
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent) === label) as HTMLButtonElement | undefined;

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([seat()]);
  repo.listActive.mockReset().mockResolvedValue([]);
  ps5.state = undefined;
  localStorage.clear();
});

describe("a free PlayStation seat", () => {
  test("while its console is going to sleep: no Start, 'going to sleep…', disabled", async () => {
    ps5.state = "GOING_TO_REST";
    await mount();
    expect(button("action.start")).toBeUndefined();
    expect(button("ps5.gate.goingToRest")?.disabled).toBe(true);
  });

  test("once it is asleep: Start, enabled", async () => {
    ps5.state = "REST";
    await mount();
    expect(button("action.start")?.disabled).toBe(false);
  });

  test("a console that vanished does not lock the seat", async () => {
    ps5.state = "OFFLINE";
    await mount();
    expect(button("action.start")?.disabled).toBe(false);
  });
});

describe("a PlayStation seat with a session running", () => {
  beforeEach(() => { repo.listActive.mockResolvedValue([running()]); });

  test("while its console is turning on: no Stop, 'turning on…', disabled", async () => {
    ps5.state = "WAKING";
    await mount();
    expect(button("action.stop")).toBeUndefined();
    expect(button("ps5.gate.waking")?.disabled).toBe(true);
  });

  test("once it is on: Stop, enabled", async () => {
    ps5.state = "ACTIVE";
    await mount();
    expect(button("action.stop")?.disabled).toBe(false);
  });

  test("a console that would not turn on does not lock the session", async () => {
    ps5.state = "ERROR";
    await mount();
    expect(button("action.stop")?.disabled).toBe(false);
  });
});
