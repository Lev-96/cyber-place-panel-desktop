// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * 2026-11-18 (owner): after Start the tile is busy, after Stop it is free —
 * AT ONCE, from the server's own answer, not after the board's next read of
 * the whole list (which here never comes back, to prove it). The PlayStation
 * signals are what they always were.
 */
const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));
const dialogs = vi.hoisted(() => ({ start: null as null | Record<string, unknown>, stop: null as null | Record<string, unknown> }));
const ps5 = vi.hoisted(() => ({ starting: vi.fn(), stopped: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    // At the till (2026-11-22): Stop holds the bill; «Продолжить игру» lets it run.
    checkout: vi.fn().mockResolvedValue({}),
    releaseCheckout: vi.fn().mockResolvedValue({}),
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/repositories/BookingRepository", () => ({
  bookingRepository: { listAll: vi.fn().mockResolvedValue([]), cancel: vi.fn(), reserve: vi.fn() },
}));
vi.mock("./StartSessionDialog", () => ({
  default: (props: Record<string, unknown>) => { dialogs.start = props; return <div data-testid="start-dialog" />; },
}));
vi.mock("./StopReceiptModal", () => ({
  default: (props: Record<string, unknown>) => { dialogs.stop = props; return <div data-testid="stop-dialog" />; },
}));
vi.mock("@/ps5/Ps5ControlProvider", async (orig) => {
  const real = await orig<Record<string, unknown>>();
  return {
    ...real,
    usePs5Control: () => ({ views: {}, statuses: {}, sessionStarting: ps5.starting, sessionStopped: ps5.stopped }),
  };
});
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }) }));

import SessionsBoard from "./SessionsBoard";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

const pc = (consoleHost: string | null = null): IPcApi => ({
  id: 1, branch_id: 7, place_id: 10, label: "PS 4", kind: PC_KIND.Ps, status: PC_STATUS.Online,
  last_seen_at: new Date().toISOString(), console_host_id: consoleHost,
  place: { id: 10, number: 4, platform: "ps5", type: "standard", status: "active" },
} as unknown as IPcApi);

const session = (): ISessionApi => ({
  id: 55, branch_id: 7, pc_id: 1, pc_label: "PS 4", mode: "open", status: "active",
  started_at: new Date().toISOString(), ends_at: null, total_paid: 0, items: [], joysticks: [],
  is_free: false, is_unlimited: true,
} as unknown as ISessionApi);

const mount = async () => {
  await act(async () => { render(<ConfirmProvider><MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter></ConfirmProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const action = (name: string) => document.querySelector(`[data-action="${name}"]`) as HTMLButtonElement | null;
/** The board's next read of the list never answers: only the instant update can change the tile. */
const listNeverAnswersAgain = () => repo.listActive.mockImplementation(() => new Promise(() => {}));

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([pc()]);
  repo.listActive.mockReset().mockResolvedValue([]);
  dialogs.start = null;
  dialogs.stop = null;
  ps5.starting.mockReset();
  ps5.stopped.mockReset();
});

describe("Start and Stop show on the board at once", () => {
  test("after Start the tile is busy before the board reads the list again", async () => {
    await mount();
    expect(action("start")).not.toBeNull();
    await act(async () => { fireEvent.click(action("start")!); });
    listNeverAnswersAgain();
    await act(async () => { (dialogs.start!.onStarted as (s?: ISessionApi) => void)(session()); });
    expect(action("stop")).not.toBeNull();
    expect(action("start")).toBeNull();
  });

  test("after Stop the tile is free before the board reads the list again", async () => {
    repo.listActive.mockResolvedValue([session()]);
    await mount();
    expect(action("stop")).not.toBeNull();
    await act(async () => { fireEvent.click(action("stop")!); });
    listNeverAnswersAgain();
    await act(async () => { (dialogs.stop!.onConfirmed as (o?: unknown) => void)({ cancelled: false }); });
    expect(action("start")).not.toBeNull();
    expect(action("stop")).toBeNull();
  });

  test("a PlayStation still gets exactly its signals: «starting» on Start, «stopped» on Stop", async () => {
    repo.listPcs.mockResolvedValue([pc("host-1")]);
    await mount();
    await act(async () => { fireEvent.click(action("start")!); });
    repo.listActive.mockResolvedValue([session()]);
    await act(async () => { (dialogs.start!.onStarted as (s?: ISessionApi) => void)(session()); });
    expect(ps5.starting).toHaveBeenCalledWith(1);
    expect(ps5.stopped).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(action("stop")!); });
    await act(async () => { (dialogs.stop!.onConfirmed as (o?: unknown) => void)({ cancelled: false }); });
    expect(ps5.stopped).toHaveBeenCalledWith(1);
    expect(ps5.starting).toHaveBeenCalledTimes(1);
  });
});
