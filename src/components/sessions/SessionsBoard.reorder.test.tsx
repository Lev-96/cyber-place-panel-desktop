// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";
import SessionsBoard from "./SessionsBoard";

/**
 * Dragging a seat on the sessions board (2026-10-11). Dropping ON a seat puts
 * the dragged one in its slot (`utils/reorder.ts`). Before, it always went IN
 * FRONT of the target, so the last slot was unreachable and one step down did
 * nothing. The whole new order is what the server stores per user
 * (`POST /pcs/reorder`).
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn(), reorderPcs: vi.fn() }));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    reorderPcs: (...a: unknown[]) => repo.reorderPcs(...a),
  },
}));
vi.mock("@/realtime/usePlaceAvailability", () => ({ usePlaceAvailability: () => {} }));
vi.mock("@/realtime/useSessionChanged", () => ({ useSessionChanged: () => {} }));
vi.mock("@/hooks/useReservedPlaceIds", () => ({ useReservedPlaceIds: () => new Set<number>() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const seat = (id: number): IPcApi => ({
  id, branch_id: 7, place_id: 100 + id, label: `Seat ${id}`, kind: PC_KIND.Ps, status: PC_STATUS.Online,
  place: { id: 100 + id, number: id, name: null, type: "standard", platform: "ps5" },
});

const mount = async () => {
  await act(async () => {
    render(<MemoryRouter><SessionsBoard branchId={7} /></MemoryRouter>);
  });
};

const cells = () => [...document.querySelectorAll<HTMLElement>(".place-cell")];
const shown = () => cells().map((c) => Number(c.querySelector(".id")!.textContent!.replace("№", "")));
const cellOf = (n: number) => cells().find((c) => c.querySelector(".id")!.textContent === `№${n}`)!;
const dataTransfer = { setDragImage: () => {}, effectAllowed: "move", dropEffect: "move" };

/** Drag seat `from` by its grip and drop it on seat `onto`. */
const drag = async (from: number, onto: number) => {
  await act(async () => { fireEvent.dragStart(cellOf(from).querySelector(".cell-grip")!, { dataTransfer }); });
  await act(async () => { fireEvent.dragOver(cellOf(onto), { dataTransfer }); });
  await act(async () => { fireEvent.drop(cellOf(onto), { dataTransfer }); });
  await act(async () => { fireEvent.dragEnd(cellOf(from).querySelector(".cell-grip")!, { dataTransfer }); });
};
const lastSent = () => repo.reorderPcs.mock.calls.at(-1)?.[1] as number[] | undefined;

afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  repo.listPcs.mockReset();
  repo.listActive.mockReset();
  repo.reorderPcs.mockReset();
  repo.listPcs.mockResolvedValue([1, 2, 3, 4, 5].map(seat));
  repo.listActive.mockResolvedValue([]);
  repo.reorderPcs.mockResolvedValue(undefined);
});

describe("SessionsBoard — dragging a seat", () => {
  test("first to last: shown and saved as the whole new order", async () => {
    await mount();
    expect(shown()).toEqual([1, 2, 3, 4, 5]);

    await drag(1, 5);
    expect(shown()).toEqual([2, 3, 4, 5, 1]);
    expect(lastSent()).toEqual([2, 3, 4, 5, 1]);
    expect(repo.reorderPcs).toHaveBeenCalledWith(7, [2, 3, 4, 5, 1]);
  });

  test("last to first", async () => {
    await mount();
    await drag(5, 1);

    expect(shown()).toEqual([5, 1, 2, 3, 4]);
    expect(lastSent()).toEqual([5, 1, 2, 3, 4]);
  });

  test("one step down and one step up", async () => {
    await mount();
    await drag(2, 3);
    expect(shown()).toEqual([1, 3, 2, 4, 5]);
    await drag(4, 2);
    expect(shown()).toEqual([1, 3, 4, 2, 5]);
  });

  test("the marker sits after a target below and before a target above", async () => {
    await mount();
    await act(async () => { fireEvent.dragStart(cellOf(1).querySelector(".cell-grip")!, { dataTransfer }); });
    await act(async () => { fireEvent.dragOver(cellOf(5), { dataTransfer }); });
    expect(cellOf(5).classList.contains("is-drop-after")).toBe(true);
    expect(cellOf(5).classList.contains("is-drop-before")).toBe(false);
    await act(async () => { fireEvent.dragEnd(cellOf(1).querySelector(".cell-grip")!, { dataTransfer }); });

    await act(async () => { fireEvent.dragStart(cellOf(5).querySelector(".cell-grip")!, { dataTransfer }); });
    await act(async () => { fireEvent.dragOver(cellOf(1), { dataTransfer }); });
    expect(cellOf(1).classList.contains("is-drop-before")).toBe(true);
  });

  test("repeated moves use the current order; nothing lost or doubled", async () => {
    await mount();
    await drag(1, 5); // 2 3 4 5 1
    await drag(1, 2); // 1 2 3 4 5
    await drag(3, 1); // 3 1 2 4 5
    expect(shown()).toEqual([3, 1, 2, 4, 5]);
    expect([...lastSent()!].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test("dropped on itself: no request", async () => {
    await mount();
    await drag(3, 3);

    expect(shown()).toEqual([1, 2, 3, 4, 5]);
    expect(repo.reorderPcs).not.toHaveBeenCalled();
  });

  test("a failed save keeps the board usable, and the next move sends the full order", async () => {
    repo.reorderPcs.mockRejectedValueOnce(new Error("offline"));
    await mount();
    await drag(1, 5);
    expect(shown()).toEqual([2, 3, 4, 5, 1]);

    await drag(2, 1);
    expect(lastSent()).toEqual([3, 4, 5, 1, 2]);
  });

  test("after a reload the board shows the order the server returns", async () => {
    await mount();
    await drag(5, 1);
    const saved = lastSent()!;
    cleanup();

    repo.listPcs.mockResolvedValue(saved.map(seat));
    await mount();
    expect(shown()).toEqual([5, 1, 2, 3, 4]);
  });
});
