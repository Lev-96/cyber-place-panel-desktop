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

const repo = vi.hoisted(() => ({ listPcs: vi.fn(), listActive: vi.fn(), returnItem: vi.fn(), addItems: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: {
    listPcs: (...a: unknown[]) => repo.listPcs(...a),
    listActive: (...a: unknown[]) => repo.listActive(...a),
    returnItem: (...a: unknown[]) => repo.returnItem(...a),
    addItems: (...a: unknown[]) => repo.addItems(...a),
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
    t: (k: string) =>
      k === "session.extraAdd" ? "add {0}" : k === "session.extraReturn" ? "return {0}" : k,
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
  repo.returnItem.mockReset().mockResolvedValue({ id: 5 });
  repo.addItems.mockReset().mockResolvedValue({ id: 5 });
  localStorage.clear();
});

/** A line the room rented out by the hour, still with the player. */
const outLine = (over: Record<string, unknown> = {}) => ([{
  id: 11, name: "Кий", price: 700, qty: 1, product_id: null,
  is_extra: true, is_hourly: true, minutes: 30, line_total: 350, returned_at: null, ...over,
}] as ISessionApi["items"]);

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

  test("what is still out can be handed back", async () => {
    repo.listActive.mockResolvedValue([{
      ...session({ name: "Кий", price: "700.00", charge_mode: "each", pricing_mode: "hourly", fee_taken: false, unit_price: "700.00", max_qty: 999 }),
      items: outLine(),
    }]);
    await mount();

    expect(buttons()).toContain("return Кий");
  });

  test("a line already handed back offers no second return", async () => {
    repo.listActive.mockResolvedValue([{
      ...session({ name: "Кий", price: "700.00", charge_mode: "each", pricing_mode: "hourly", fee_taken: false, unit_price: "700.00", max_qty: 999 }),
      items: outLine({ returned_at: "2026-09-22T01:00:00+04:00" }),
    }]);
    await mount();

    expect(buttons().some((l) => l.startsWith("return "))).toBe(false);
  });

  /**
   * ⚠️ A FIXED extra is offered a return too.
   *
   * It was not, back when handing something back meant stopping a charge. It
   * means "the thing came back" now — as true of chips sold at a flat price as
   * of a rented cue — and the charge stays either way, exactly as a fee pad's
   * does.
   */
  test("a FIXED extra out is offered a return", async () => {
    repo.listActive.mockResolvedValue([{
      ...session({ name: "\u0424\u0438\u0448\u043a\u0438", price: "500.00", charge_mode: "each", pricing_mode: "fixed", fee_taken: false, unit_price: "500.00", max_qty: 999 }),
      items: outLine({ name: "\u0424\u0438\u0448\u043a\u0438", is_hourly: false, minutes: null }),
    }]);
    await mount();

    expect(buttons()).toContain("return \u0424\u0438\u0448\u043a\u0438");
  });

  /** ONE control, not two: what is out cannot also be offered again. */
  test("while something is out the hand-out button is gone", async () => {
    repo.listActive.mockResolvedValue([{
      ...session({ name: "\u041a\u0438\u0439", price: "700.00", charge_mode: "each", pricing_mode: "hourly", fee_taken: false, unit_price: "700.00", max_qty: 999 }),
      items: outLine(),
    }]);
    await mount();

    expect(buttons().some((l) => l.startsWith("add "))).toBe(false);
    expect(buttons()).toContain("return \u041a\u0438\u0439");
  });

  /** …and once it is back, the same button offers it again. */
  test("a seat with everything returned is offered the hand-out again", async () => {
    repo.listActive.mockResolvedValue([{
      ...session({ name: "\u041a\u0438\u0439", price: "700.00", charge_mode: "each", pricing_mode: "hourly", fee_taken: false, unit_price: "700.00", max_qty: 999 }),
      items: outLine({ returned_at: "2026-09-23T01:00:00+04:00" }),
    }]);
    await mount();

    expect(buttons()).toContain("add \u041a\u0438\u0439");
    expect(buttons().some((l) => l.startsWith("return "))).toBe(false);
  });

  test("pressing it hands that line back", async () => {
    repo.listActive.mockResolvedValue([{
      ...session({ name: "Кий", price: "700.00", charge_mode: "each", pricing_mode: "hourly", fee_taken: false, unit_price: "700.00", max_qty: 999 }),
      items: outLine(),
    }]);
    await mount();

    const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "return Кий")!;
    await act(async () => { button.click(); });

    expect(repo.returnItem).toHaveBeenCalledWith(5, 11);
  });

  test("a payload that never mentioned the field shows no button either", async () => {
    const withoutField = session(null);
    delete (withoutField as { extra_item?: unknown }).extra_item;
    repo.listActive.mockResolvedValue([withoutField]);
    await mount();

    expect(buttons().some((label) => label.startsWith("add "))).toBe(false);
  });
});

/**
 * Handing it out is ONE PRESS, exactly as handing out a pad is.
 *
 * The button used to open a dialog with a quantity stepper. A cashier putting
 * chips on a poker table is doing what a cashier putting a controller on a
 * PlayStation does — one press, one thing, no menu — and the count was a
 * question nobody at the counter was asking. A FIXED extra simply adds its
 * price; an HOURLY one starts its rate, and the "return" button stops it.
 */
describe("handing the room's extra out", () => {
  const seatWith = (over: Record<string, unknown> = {}) => ({
    ...session({
      name: "\u0424\u0438\u0448\u043a\u0438", price: "500.00", charge_mode: "each", pricing_mode: "fixed",
      fee_taken: false, unit_price: "500.00", max_qty: 999,
    }),
    ...over,
  });

  test("one press hands over exactly one, with no dialog in between", async () => {
    repo.listActive.mockResolvedValue([seatWith()]);
    await mount();

    const button = [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "add \u0424\u0438\u0448\u043a\u0438")!;
    await act(async () => { button.click(); });

    expect(repo.addItems).toHaveBeenCalledWith(5, [{ extra: true, qty: 1 }]);
  });

  test("no quantity is ever asked for", async () => {
    repo.listActive.mockResolvedValue([seatWith()]);
    await mount();

    const button = [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "add \u0424\u0438\u0448\u043a\u0438")!;
    await act(async () => { button.click(); });

    // A stepper would put a number input on the screen; there is none.
    expect(document.querySelector('input[type="number"]')).toBeNull();
  });

  test("a second press hands over a second one", async () => {
    repo.listActive.mockResolvedValue([seatWith()]);
    await mount();

    const button = () => [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "add \u0424\u0438\u0448\u043a\u0438")!;
    await act(async () => { button().click(); });
    await act(async () => { button().click(); });

    expect(repo.addItems).toHaveBeenCalledTimes(2);
  });
});
