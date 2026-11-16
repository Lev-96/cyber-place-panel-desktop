// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBranchPlace } from "@/types/api";
import type { ISessionApi } from "@/types/sessions";

/**
 * The History screen's place filter (2026-11-15): «Место» after the staff
 * picker. The SERVER narrows (`place_id` on the sessions list, the person's
 * list and the events feed); the screen only sends it. While a place is
 * picked, the till sales and the bookings — which belong to no seat — step
 * aside with one muted line. Without a place, every request is the one it
 * always was, key for key.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n} AMD`, lang: "en" }),
}));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const repo = vi.hoisted(() => ({
  list: vi.fn(),
  listEvents: vi.fn(),
  eventsForSession: vi.fn(),
  listEventActors: vi.fn(),
}));
vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    list: (...a: unknown[]) => repo.list(...a),
    listEvents: (...a: unknown[]) => repo.listEvents(...a),
    eventsForSession: (...a: unknown[]) => repo.eventsForSession(...a),
    listEventActors: (...a: unknown[]) => repo.listEventActors(...a),
  },
}));
const places = vi.hoisted(() => ({ listRawByBranch: vi.fn() }));
vi.mock("@/repositories/PlaceRepository", () => ({
  placeRepository: { listRawByBranch: (...a: unknown[]) => places.listRawByBranch(...a) },
}));
const orders = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/OrderRepository", () => ({
  orderRepository: { list: (...a: unknown[]) => orders.list(...a) },
}));
const bookings = vi.hoisted(() => ({ listEvents: vi.fn() }));
vi.mock("@/repositories/BookingRepository", () => ({
  bookingRepository: { listEvents: (...a: unknown[]) => bookings.listEvents(...a) },
}));

import SessionsHistory from "./SessionsHistory";

const place = (id: number, number: number, name: string | null): IBranchPlace => ({
  id, branch_id: 1, number, name, type: "standard", status: "active", platform: "ps5",
} as IBranchPlace);

const session = (id: number): ISessionApi => ({
  id, pc_id: id, pc_label: `№${id}`, status: "stopped", mode: "open",
  started_at: new Date().toISOString(), stopped_at: new Date().toISOString(), ends_at: new Date().toISOString(),
  total_paid: 1000, items: [], opened_by: { id: 1, name: "Anna" }, stopped_by: { id: 1, name: "Anna" },
} as unknown as ISessionApi);

const nav = { go: (_to: string) => {} };
const NavProbe = () => {
  const navigate = useNavigate();
  nav.go = navigate;
  return null;
};

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); });
};

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/1/sessions/history"]}>
        <NavProbe />
        <Routes>
          <Route path="/branches/:branchId/sessions/history" element={<SessionsHistory />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await settle();
};

const placeSelect = () => screen.getByTestId("history-place") as HTMLSelectElement;
const pick = async (value: string) => {
  await act(async () => { fireEvent.change(placeSelect(), { target: { value } }); });
  await settle();
};
const lastArg = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0] as Record<string, unknown>;

beforeEach(() => {
  for (const f of [repo.list, repo.listEvents, repo.eventsForSession, repo.listEventActors, places.listRawByBranch, orders.list, bookings.listEvents]) f.mockReset();
  repo.list.mockResolvedValue([session(8)]);
  repo.listEvents.mockResolvedValue([]);
  repo.eventsForSession.mockResolvedValue([]);
  repo.listEventActors.mockResolvedValue([{ id: 5, name: "Boris", role: "manager" }]);
  places.listRawByBranch.mockResolvedValue([
    place(32, 3, null),
    place(31, 1, "Hall VIP with a very long name that will not fit"),
    place(30, 2, "Corner"),
  ]);
  orders.list.mockResolvedValue([]);
  bookings.listEvents.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("SessionsHistory — the place filter", () => {
  test("«all places» first, then every place as its seat line, in number order, after the staff picker", async () => {
    await mount();

    expect(places.listRawByBranch).toHaveBeenCalledWith(1);
    const options = [...placeSelect().options].map((o) => [o.value, o.textContent, o.title]);
    expect(options).toEqual([
      ["", "history.placeAll", "history.placeAll"],
      ["31", "№1 · Hall VIP with a very long name that will not fit", "№1 · Hall VIP with a very long name that will not fit"],
      ["30", "№2 · Corner", "№2 · Corner"],
      ["32", "№3", "№3"],
    ]);
    // After «Сотрудник», under its own label.
    const selects = [...document.querySelectorAll("select")];
    expect(selects.indexOf(placeSelect())).toBe(selects.length - 1);
    expect(placeSelect().closest("label")?.textContent).toContain("history.placeLabel");
  });

  test("without a place, every read is the request it always was — no place_id key at all", async () => {
    await mount();

    expect(Object.keys(lastArg(repo.list)).sort()).toEqual(["branch_id", "from", "limit", "to"]);
    expect(Object.keys(lastArg(repo.listEvents)).sort()).toEqual(["branch_id", "from", "limit", "to"]);
    expect(orders.list).toHaveBeenCalled();
    expect(bookings.listEvents).toHaveBeenCalled();
    expect(screen.queryByText("history.placeHidesTill")).toBeNull();
  });

  test("a picked place goes on the sessions list and the events feed", async () => {
    await mount();
    await pick("30");

    expect(lastArg(repo.list)).toMatchObject({ branch_id: 1, place_id: 30 });
    expect(lastArg(repo.listEvents)).toMatchObject({ branch_id: 1, place_id: 30 });
    expect(placeSelect().value).toBe("30");
    expect(placeSelect().title).toBe("№2 · Corner");
  });

  test("with a person picked too, the person's list carries the place as well", async () => {
    await mount();
    const actor = document.querySelectorAll("select")[0] as HTMLSelectElement;
    await act(async () => { fireEvent.change(actor, { target: { value: "5" } }); });
    await settle();
    await pick("31");

    const actedCalls = repo.list.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((a) => a.acted_by === 5);
    expect(actedCalls[actedCalls.length - 1]).toMatchObject({ acted_by: 5, place_id: 31 });
    expect(lastArg(repo.listEvents)).toMatchObject({ user_id: 5, place_id: 31 });
  });

  test("while a place is picked, the till sales and bookings step aside with a muted line", async () => {
    await mount();
    expect(screen.queryByTestId("booking-history")).not.toBeNull();

    await pick("30");
    expect(screen.queryByTestId("booking-history")).toBeNull();
    expect(document.querySelector(".till-history")).toBeNull();
    const line = screen.getByText("history.placeHidesTill");
    expect(line.className).toContain("muted");

    await pick("");
    expect(screen.queryByTestId("booking-history")).not.toBeNull();
    expect(screen.queryByText("history.placeHidesTill")).toBeNull();
    expect(Object.keys(lastArg(repo.list)).sort()).toEqual(["branch_id", "from", "limit", "to"]);
  });

  test("the pick belongs to its branch: another branch starts from «all places»", async () => {
    await mount();
    await pick("30");

    await act(async () => { nav.go("/branches/2/sessions/history"); });
    await settle();

    expect(placeSelect().value).toBe("");
    expect(lastArg(repo.list)).toMatchObject({ branch_id: 2 });
    expect(lastArg(repo.list)).not.toHaveProperty("place_id");
    expect(places.listRawByBranch).toHaveBeenLastCalledWith(2);
  });

  test("a place list that could not be read says so and offers the retry", async () => {
    places.listRawByBranch.mockRejectedValueOnce(new Error("offline"));
    await mount();

    expect([...placeSelect().options].map((o) => o.value)).toEqual([""]);
    const retry = screen.getByText("history.state.placesFailed");
    await act(async () => { fireEvent.click(retry); });
    await settle();

    expect(places.listRawByBranch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("history.state.placesFailed")).toBeNull();
    expect(placeSelect().options).toHaveLength(4);
  });
});
