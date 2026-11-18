// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * Seats that ended while no board was open (2026-11-18, owner: every payment
 * carries its way of paying). The board looks for this branch's ended seats
 * with no method on record and opens the same mandatory receipt for each, one
 * at a time, never over a receipt already open; at most one look a minute.
 */
const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn(), list: vi.fn() }));
const dialogs = vi.hoisted(() => ({ stop: null as null | Record<string, unknown>, stopOpens: [] as number[] }));
const ps5 = vi.hoisted(() => ({ starting: vi.fn(), stopped: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    list: (...a: unknown[]) => repo.list(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/repositories/BookingRepository", () => ({
  bookingRepository: { listAll: vi.fn().mockResolvedValue([]), cancel: vi.fn(), reserve: vi.fn() },
}));
vi.mock("./StartSessionDialog", () => ({ default: () => <div data-testid="start-dialog" /> }));
vi.mock("./StopReceiptModal", async () => {
  const { useEffect } = await import("react");
  return {
    default: (props: Record<string, unknown>) => {
      dialogs.stop = props;
      const id = (props.session as ISessionApi).id;
      // One entry per receipt OPENED (mount), not per render.
      useEffect(() => { dialogs.stopOpens.push(id); }, [id]);
      return <div data-testid="stop-dialog" data-session={id} />;
    },
  };
});
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

const running = (): ISessionApi => ({
  id: 55, branch_id: 7, pc_id: 1, pc_label: "PS 4", mode: "open", status: "active",
  started_at: new Date().toISOString(), ends_at: null, total_paid: 0, items: [], joysticks: [],
  is_free: false, is_unlimited: true,
} as unknown as ISessionApi);

/** An ended seat as the history list sends it: unpaid unless told otherwise. */
const ended = (id: number, over: Partial<ISessionApi> = {}): ISessionApi => ({
  id, branch_id: 7, pc_id: 2, pc_label: `PC ${id}`, mode: "fixed", status: "expired",
  started_at: new Date(Date.now() - 2 * 3600_000).toISOString(), stopped_at: new Date(Date.now() - 3600_000).toISOString(),
  total_paid: 1500, payment_method: null, payments: [], is_free: false, cancelled_at: null, items: [], joysticks: [],
  ...over,
} as unknown as ISessionApi);

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const mount = async () => {
  await act(async () => { render(<ConfirmProvider><MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter></ConfirmProvider>); });
  await flush();
};
const openReceipt = () => document.querySelector('[data-testid="stop-dialog"]')?.getAttribute("data-session") ?? null;
const closeReceipt = async () => { await act(async () => { (dialogs.stop!.onClose as () => void)(); }); await flush(); };
const action = (name: string) => document.querySelector(`[data-action="${name}"]`) as HTMLButtonElement | null;

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([pc()]);
  repo.listActive.mockReset().mockResolvedValue([]);
  repo.list.mockReset().mockResolvedValue([]);
  dialogs.stop = null;
  dialogs.stopOpens = [];
  ps5.starting.mockReset();
  ps5.stopped.mockReset();
});

describe("seats that ended unpaid while no board was open", () => {
  test("on mount: reads this branch's last 24 hours and opens the receipt of an unpaid ended seat", async () => {
    repo.list.mockResolvedValue([ended(901)]);
    const before = Date.now();
    await mount();

    expect(repo.list).toHaveBeenCalledTimes(1);
    const params = repo.list.mock.calls[0][0] as { branch_id: number; from: string; limit: number };
    expect(params.branch_id).toBe(7);
    expect(params.limit).toBe(200);
    const from = Date.parse(params.from);
    expect(before - from).toBeGreaterThanOrEqual(24 * 3600_000 - 1000);
    expect(before - from).toBeLessThanOrEqual(24 * 3600_000 + 1000);
    expect(openReceipt()).toBe("901");
  });

  test("one at a time: the next opens only after the first is closed", async () => {
    repo.list.mockResolvedValue([ended(901), ended(902, { status: "stopped" })]);
    await mount();
    expect(openReceipt()).toBe("901");
    expect(dialogs.stopOpens).toEqual([901]);

    await closeReceipt();
    expect(openReceipt()).toBe("902");
    await closeReceipt();
    expect(openReceipt()).toBeNull();
    expect(dialogs.stopOpens).toEqual([901, 902]);
  });

  test("never over a receipt already open: it waits until that one is closed", async () => {
    let answer!: (v: ISessionApi[]) => void;
    repo.list.mockImplementation(() => new Promise((r) => { answer = r; }));
    repo.listActive.mockResolvedValue([running()]);
    await mount();
    // The cashier opens the running seat's receipt before the look answers.
    await act(async () => { fireEvent.click(action("stop")!); });
    expect(openReceipt()).toBe("55");

    await act(async () => { answer([ended(901)]); });
    await flush();
    expect(openReceipt()).toBe("55");

    await closeReceipt();
    expect(openReceipt()).toBe("901");
  });

  test("free, cancelled, paid, split-paid, zero and running seats are not asked about", async () => {
    repo.list.mockResolvedValue([
      ended(1, { is_free: true }),
      ended(2, { cancelled_at: new Date().toISOString() }),
      ended(3, { payment_method: "cash" }),
      ended(4, { payments: [{ method: "card", amount: 1500 }] }),
      ended(5, { total_paid: 0 }),
      ended(6, { status: "active" }),
      ended(7, { branch_id: 8 }),
    ]);
    await mount();
    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(openReceipt()).toBeNull();
  });

  test("one look on mount, then one a minute, however often the board reads", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount();
    expect(repo.list).toHaveBeenCalledTimes(1);

    // The board's own poll (every 30 s) reads the list again: no second look.
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(repo.listActive.mock.calls.length).toBeGreaterThan(1);
    expect(repo.list).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(repo.list).toHaveBeenCalledTimes(2);
  });

  test("a seat settled here is not asked about again, even if a look still lists it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    repo.list.mockResolvedValue([ended(901)]);
    await mount();
    expect(openReceipt()).toBe("901");
    await act(async () => { (dialogs.stop!.onPaymentSettled as (id: number) => void)(901); });
    await closeReceipt();
    expect(openReceipt()).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(repo.list.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(openReceipt()).toBeNull();
    expect(dialogs.stopOpens).toEqual([901]);
  });

  test("a seat closed unsettled is found again by the next look", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    repo.list.mockResolvedValue([ended(901)]);
    await mount();
    await closeReceipt();
    expect(openReceipt()).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(openReceipt()).toBe("901");
  });

  test("a failed look opens nothing and breaks nothing", async () => {
    repo.list.mockRejectedValue(new Error("offline"));
    await mount();
    expect(openReceipt()).toBeNull();
    expect(document.querySelector(".board-error")).toBeNull();
  });

  test("the PlayStation signals on Stop are exactly as before", async () => {
    repo.listPcs.mockResolvedValue([pc("host-1")]);
    repo.listActive.mockResolvedValue([running()]);
    await mount();
    await act(async () => { fireEvent.click(action("stop")!); });
    await act(async () => { (dialogs.stop!.onConfirmed as (o?: unknown) => void)({ cancelled: false }); });
    expect(ps5.stopped).toHaveBeenCalledTimes(1);
    expect(ps5.stopped).toHaveBeenCalledWith(1);
    expect(ps5.starting).not.toHaveBeenCalled();
  });
});
