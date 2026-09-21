// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_KIND, PC_STATUS } from "@/types/pc";

/**
 * The control for the room's OWN extra, on the board.
 *
 * The rule it follows is the one the pad menu already follows: the server
 * decides. `extra_item` arrives as an object or as null, and a button appears
 * only for the first — so a control on screen is always one the server will
 * honour, and a seat whose room hands out nothing shows nothing.
 *
 * And the label is the owner's word, not ours. A board that said "chips" would
 * be wrong on a billiard table the day somebody opened one.
 */

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn() }));

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
  useLang: () => ({
    // A template for the one key the owner's word lands in; everything else
    // is its own key, so an assertion names a key and not a sentence.
    t: (k: string) => (k === "session.extraAdd" ? "add {0}" : k),
    money: (n: number) => String(n),
    lang: "en",
  }),
}));

import SessionsBoard from "./SessionsBoard";

const pc = (over: Partial<IPcApi> = {}): IPcApi => ({
  id: 1,
  branch_id: 7,
  place_id: 10,
  label: "Table 1",
  kind: PC_KIND.Ps,
  status: PC_STATUS.Online,
  place: { id: 10, number: 1, name: "Table 1", type: "standard", platform: "poker" },
  ...over,
});

const session = (extra: ISessionApi["extra_item"]): ISessionApi => ({
  id: 5,
  pc_id: 1,
  branch_id: 7,
  status: "active",
  mode: "open",
  started_at: new Date().toISOString(),
  ends_at: null,
  hourly_rate: 1000,
  items: [],
  joysticks: [],
  supports_joysticks: false,
  extra_item: extra,
} as unknown as ISessionApi);

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <SessionsBoard branchId={7} />
      </MemoryRouter>,
    );
  });
};

const buttons = () => [...document.querySelectorAll("button")].map((b) => b.textContent ?? "");

afterEach(() => cleanup());
beforeEach(() => {
  repo.listPcs.mockReset().mockResolvedValue([pc()]);
  repo.listActive.mockReset().mockResolvedValue([]);
  localStorage.clear();
});

describe("SessionsBoard — the room's own extra", () => {
  test("the button carries the room's word", async () => {
    repo.listActive.mockResolvedValue([
      session({ name: "Фишки", price: "500.00", charge_mode: "each", fee_taken: false, unit_price: "500.00", max_qty: 999 }),
    ]);
    await mount();

    expect(buttons()).toContain("add Фишки");
  });

  test("another room's word is another button", async () => {
    repo.listActive.mockResolvedValue([
      session({ name: "Кий", price: "700.00", charge_mode: "once", fee_taken: false, unit_price: "700.00", max_qty: 999 }),
    ]);
    await mount();

    expect(buttons()).toContain("add Кий");
    // Nothing on this board is named after a joystick or a chip.
    expect(buttons().join(" ")).not.toContain("Фишки");
  });

  test("a seat whose room hands out nothing shows no button", async () => {
    repo.listActive.mockResolvedValue([session(null)]);
    await mount();

    expect(buttons().some((label) => label.startsWith("add "))).toBe(false);
  });

  test("a payload that never mentioned the field shows no button either", async () => {
    const withoutField = session(null);
    delete (withoutField as { extra_item?: unknown }).extra_item;
    repo.listActive.mockResolvedValue([withoutField]);
    await mount();

    expect(buttons().some((label) => label.startsWith("add "))).toBe(false);
  });
});
