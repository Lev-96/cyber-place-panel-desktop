// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * After «Переместить игрока» the consoles on both sides must hear of it.
 *
 * The console left behind is told its session stopped, the one the player
 * went to that one is starting — BEFORE the reload, as Start does, so the
 * monitor never sees "awake, no session" and switches the new console off
 * under the player. Seats without a console are told nothing.
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
const ps5 = vi.hoisted(() => ({ sessionStarting: vi.fn(), sessionStopped: vi.fn() }));
const moveTo = vi.hoisted(() => ({ pcId: 2 }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/ps5/Ps5ControlProvider", () => ({
  usePs5Control: () => ({ views: {}, statuses: {}, sessionStarting: ps5.sessionStarting, sessionStopped: ps5.sessionStopped }),
}));
// The dialog's own behaviour is proven in its own file; here it only reports
// a move the server accepted.
vi.mock("./RelocateSessionDialog", () => ({
  default: ({ session, onMoved }: { session: ISessionApi; onMoved: (s: ISessionApi, from: { pcId: number }) => void }) => (
    <button onClick={() => onMoved({ ...session, pc_id: moveTo.pcId }, { pcId: session.pc_id })}>fake-move</button>
  ),
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

import SessionsBoard from "./SessionsBoard";

const device = (id: number, console: boolean): IPcApi => ({
  id, branch_id: 7, place_id: 10 + id, label: `№${id}`,
  kind: console ? PC_KIND.Ps : PC_KIND.Pc, status: id === 1 ? PC_STATUS.InSession : PC_STATUS.Online,
  console_host_id: console ? `host-${id}` : null,
  place: { id: 10 + id, number: id, name: `№${id}`, type: "standard", platform: console ? "ps5" : "pc" },
} as IPcApi);

const running = (): ISessionApi => ({
  id: 5, pc_id: 1, branch_id: 7, status: "active", mode: "fixed",
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  ends_at: new Date(Date.now() + 50 * 60_000).toISOString(),
  hourly_rate: null, total_paid: 1500, committed_amount: 1500,
  time_package: { duration_minutes: 60, price: 1500 },
  items: [], joysticks: [], supports_joysticks: true, extra_item: null, paused_at: null, pauses: [],
} as unknown as ISessionApi);

const click = async (label: string) => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent === label)!;
  await act(async () => { b.click(); });
};

afterEach(() => cleanup());
beforeEach(() => {
  ps5.sessionStarting.mockReset();
  ps5.sessionStopped.mockReset();
  repo.listActive.mockReset().mockResolvedValue([running()]);
  localStorage.clear();
});

describe("SessionsBoard — consoles follow a move", () => {
  test("console to console: the old one stops, the new one starts", async () => {
    repo.listPcs.mockReset().mockResolvedValue([device(1, true), device(2, true)]);
    moveTo.pcId = 2;
    await act(async () => { render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>); });

    await click("session.relocate");
    await click("fake-move");

    expect(ps5.sessionStopped).toHaveBeenCalledWith(1);
    expect(ps5.sessionStarting).toHaveBeenCalledWith(2);
  });

  test("a seat without a console is told nothing", async () => {
    repo.listPcs.mockReset().mockResolvedValue([device(1, true), device(3, false)]);
    moveTo.pcId = 3;
    await act(async () => { render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>); });

    await click("session.relocate");
    await click("fake-move");

    expect(ps5.sessionStopped).toHaveBeenCalledWith(1);
    expect(ps5.sessionStarting).not.toHaveBeenCalled();
  });
});
