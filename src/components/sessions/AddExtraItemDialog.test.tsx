// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISessionApi } from "@/types/sessions";

/**
 * Handing out what the ROOM hands out, whatever it is called.
 *
 * One dialog serves a poker table, a billiard table and a darts board, because
 * the thing it sells is data: the word comes from the place, and nothing in
 * the component spells "chips" or "cue". What is worth pinning is that the
 * word reaches every label, that the quantity cannot leave the range the
 * server accepts, that "once for the session" quotes one charge rather than a
 * multiplied one, and — the security-relevant one — that the write carries a
 * COUNT and never a price.
 */

const repo = vi.hoisted(() => ({ addItems: vi.fn() }));

vi.mock("@/repositories/SessionRepository", () => ({
  sessionRepository: { addItems: (...a: unknown[]) => repo.addItems(...a) },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    // Two keys come back as templates so the case that proves the word is
    // dynamic has a `{0}` to land in; everything else is its own key.
    t: (k: string) =>
      k === "session.extraAdd" ? "add {0}" : k === "session.extraQty" ? "how many ({0})" : k,
    money: (n: number) => `${n} AMD`,
    currency: "AMD",
    lang: "ru",
  }),
}));
// The mock HONOURS `open`, and that is the point: the real Modal renders
// nothing without it, and a mock that ignored the prop let a dialog that could
// never open pass every case in this file. It did, once — the button was on
// the board and pressing it did nothing at all.
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    (open ? <div>{children}</div> : null),
}));

import AddExtraItemDialog from "./AddExtraItemDialog";

const session = (extra: ISessionApi["extra_item"]): ISessionApi => ({
  id: 5,
  branch_id: 7,
  status: "active",
  extra_item: extra,
} as unknown as ISessionApi);

const chips = {
  name: "Фишки",
  price: "500.00",
  charge_mode: "each" as const,
  fee_taken: false,
  unit_price: "500.00",
  max_qty: 999,
};

let dom: HTMLElement;

const mount = async (extra: ISessionApi["extra_item"]) => {
  await act(async () => {
    const r = render(<AddExtraItemDialog session={session(extra)} onClose={() => {}} onAdded={() => {}} />);
    dom = r.container;
  });
};

const qtyBox = () => dom.querySelector<HTMLInputElement>('input[type="number"]')!;
const confirm = async () => {
  const button = [...dom.querySelectorAll("button")].find((b) => b.textContent === "add Фишки");
  expect(button, "no confirm button").toBeTruthy();
  await act(async () => { fireEvent.click(button!); });
};

beforeEach(() => { repo.addItems.mockReset().mockResolvedValue({ id: 5 }); });
afterEach(cleanup);

describe("handing out the room's extra", () => {
  test("every label carries the room's own word", async () => {
    await mount(chips);

    expect(dom.textContent).toContain("add Фишки");
    expect(dom.textContent).toContain("how many (Фишки)");
    expect(dom.textContent).not.toContain("{0}");
  });

  test("a room that hands out nothing draws no dialog", async () => {
    await mount(null);

    expect(dom.textContent).toBe("");
  });

  test("the total follows the count", async () => {
    await mount(chips);

    expect(dom.textContent).toContain("500 AMD");

    await act(async () => { fireEvent.change(qtyBox(), { target: { value: "20" } }); });

    expect(dom.textContent).toContain("10000 AMD");
  });

  test("once for the session quotes one charge, not a multiplied one", async () => {
    await mount({ ...chips, name: "Кий", charge_mode: "once" });

    await act(async () => { fireEvent.change(qtyBox(), { target: { value: "4" } }); });

    expect(dom.textContent).toContain("500 AMD");
    expect(dom.textContent).not.toContain("2000 AMD");
    expect(dom.textContent).toContain("session.extraOnceNote");
  });

  test("a seat that already paid the one-off quotes zero", async () => {
    await mount({ ...chips, charge_mode: "once", fee_taken: true, unit_price: "0.00" });

    expect(dom.textContent).toContain("0 AMD");
  });

  test("the count cannot go below one", async () => {
    await mount(chips);

    await act(async () => { fireEvent.change(qtyBox(), { target: { value: "0" } }); });

    expect(qtyBox().value).toBe("1");
  });

  test("the count cannot pass the server's ceiling", async () => {
    await mount({ ...chips, max_qty: 50 });

    await act(async () => { fireEvent.change(qtyBox(), { target: { value: "999" } }); });

    expect(qtyBox().value).toBe("50");
  });

  test("a fractional count is truncated rather than sent", async () => {
    await mount(chips);

    await act(async () => { fireEvent.change(qtyBox(), { target: { value: "3.7" } }); });

    expect(qtyBox().value).toBe("3");
  });

  test("the write carries a count and no price at all", async () => {
    await mount(chips);

    await act(async () => { fireEvent.change(qtyBox(), { target: { value: "7" } }); });
    await confirm();

    expect(repo.addItems).toHaveBeenCalledTimes(1);

    const [sessionId, lines] = repo.addItems.mock.calls[0];

    expect(sessionId).toBe(5);
    expect(lines).toEqual([{ extra: true, qty: 7 }]);
    // The price is the ROOM's. A dialog that could name one would be a dialog
    // that lets a manager write one onto a bill.
    expect(JSON.stringify(lines)).not.toContain("price");
    expect(JSON.stringify(lines)).not.toContain("name");
  });

  test("a refusal is shown and nothing is claimed to have happened", async () => {
    repo.addItems.mockRejectedValueOnce(new Error("nope"));
    const onAdded = vi.fn();

    await act(async () => {
      const r = render(
        <AddExtraItemDialog session={session(chips)} onClose={() => {}} onAdded={onAdded} />,
      );
      dom = r.container;
    });

    await confirm();

    expect(onAdded).not.toHaveBeenCalled();
    expect(dom.querySelector(".error")).toBeTruthy();
  });
});
