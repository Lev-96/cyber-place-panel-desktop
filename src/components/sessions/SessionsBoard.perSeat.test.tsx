// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * A cashier works several seats at once. A press on seat №2 while seat №1's
 * request is still out must GO THROUGH — the in-flight guards are per seat.
 * They used to be one `number | null` per action: the second seat's press
 * returned early with no request and no error, and the operator saw a button
 * that did nothing.
 *
 * The same-seat double press stays one request (SessionsBoard.pause.test).
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn(), pause: vi.fn(), addItems: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    pause: (...a: unknown[]) => repo.pause(...a),
    addItems: (...a: unknown[]) => repo.addItems(...a),
    reorderPcs: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (k === "session.extraAdd" ? "add {0}" : k), money: (n: number) => String(n), lang: "en" }),
}));

import SessionsBoard from "./SessionsBoard";

const seat = (id: number): IPcApi => ({
  id, branch_id: 7, place_id: 10 + id, label: `Table ${id}`, kind: PC_KIND.Ps, status: PC_STATUS.InSession,
  place: { id: 10 + id, number: id, name: `Table ${id}`, type: "standard", platform: "poker" },
} as IPcApi);

const running = (id: number): ISessionApi => ({
  id: 100 + id, pc_id: id, branch_id: 7, status: "active", mode: "open",
  started_at: new Date(Date.now() - 60_000).toISOString(), ends_at: null, hourly_rate: 1000,
  items: [], joysticks: [], supports_joysticks: false, paused_at: null, pauses: [],
  extra_item: { name: "Фишки", price: "500.00", charge_mode: "each", fee_taken: false, unit_price: "500.00", max_qty: 999 },
} as unknown as ISessionApi);

const buttonsLabelled = (label: string) =>
  [...document.querySelectorAll("button")].filter((b) => b.textContent === label) as HTMLButtonElement[];

const mount = async () => {
  await act(async () => { render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>); });
};

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([seat(1), seat(2)]);
  repo.listActive.mockReset().mockResolvedValue([running(1), running(2)]);
  // Never answers: seat №1's request stays in flight for the whole test.
  repo.pause.mockReset().mockReturnValue(new Promise(() => {}));
  repo.addItems.mockReset().mockReturnValue(new Promise(() => {}));
  localStorage.clear();
});

describe("SessionsBoard — in-flight guards are per seat", () => {
  test("pausing seat №2 is not blocked by seat №1's pause in flight", async () => {
    await mount();
    const [first, second] = buttonsLabelled("session.pause");

    await act(async () => { first.click(); });
    await act(async () => { second.click(); });

    expect(repo.pause).toHaveBeenCalledTimes(2);
    expect(repo.pause).toHaveBeenNthCalledWith(1, 101);
    expect(repo.pause).toHaveBeenNthCalledWith(2, 102);
  });

  test("a second press on the SAME seat is still one request, and only that seat greys", async () => {
    await mount();
    const [first] = buttonsLabelled("session.pause");

    await act(async () => { first.click(); first.click(); });

    expect(repo.pause).toHaveBeenCalledTimes(1);
    const [again, other] = buttonsLabelled("session.pause");
    expect(again.disabled).toBe(true);
    expect(other.disabled).toBe(false);
  });

  test("handing out on seat №2 is not blocked by seat №1's hand-out in flight", async () => {
    await mount();
    const [first, second] = buttonsLabelled("add Фишки");

    await act(async () => { first.click(); });
    await act(async () => { second.click(); });

    expect(repo.addItems).toHaveBeenCalledTimes(2);
    expect(repo.addItems.mock.calls.map((c) => c[0])).toEqual([101, 102]);
  });
});

describe("SessionsBoard — a refused hand-out is shown on every kind of seat", () => {
  test("a custom room (no pads) shows the server's sentence on its card", async () => {
    repo.listPcs.mockResolvedValue([seat(1)]);
    repo.listActive.mockResolvedValue([running(1)]);
    repo.addItems.mockReset().mockRejectedValue(new Error("No price is set for Фишки"));
    await mount();

    await act(async () => { buttonsLabelled("add Фишки")[0].click(); });

    expect(document.querySelector(".place-cell")?.textContent).toContain("No price is set for Фишки");
  });
});
