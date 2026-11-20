import { afterEach, describe, expect, test, vi } from "vitest";
import { afterDueConfirmed, registerDueAsker } from "./dueConfirmGate";

/** The seam between the board's final bill and «Эти товары оплатили?» (2026-11-20). */
describe("dueConfirmGate", () => {
  let off: (() => void) | null = null;
  afterEach(() => { off?.(); off = null; });

  test("nobody asks: the bill opens at once, in the same tick", () => {
    const bill = vi.fn();
    afterDueConfirmed(1, bill);
    expect(bill).toHaveBeenCalledTimes(1);
  });

  test("the bill waits for the answer, then opens once", async () => {
    let answer: () => void = () => {};
    off = registerDueAsker(() => new Promise<void>((r) => { answer = r; }));
    const bill = vi.fn();
    afterDueConfirmed(1, bill);
    await Promise.resolve();
    expect(bill).not.toHaveBeenCalled();
    answer();
    await Promise.resolve();
    expect(bill).toHaveBeenCalledTimes(1);
  });

  test("an asker that fails or throws never swallows the bill", async () => {
    off = registerDueAsker(() => Promise.reject(new Error("x")));
    const a = vi.fn();
    afterDueConfirmed(1, a);
    await Promise.resolve(); await Promise.resolve();
    expect(a).toHaveBeenCalledTimes(1);
    off();
    off = registerDueAsker(() => { throw new Error("y"); });
    const b = vi.fn();
    afterDueConfirmed(2, b);
    expect(b).toHaveBeenCalledTimes(1);
  });

  test("taking the asker back: only its own registration", () => {
    const first = registerDueAsker(() => new Promise<void>(() => {}));
    off = registerDueAsker(() => Promise.resolve());
    first();
    const bill = vi.fn();
    afterDueConfirmed(1, bill);
    return Promise.resolve().then(() => Promise.resolve()).then(() => expect(bill).toHaveBeenCalledTimes(1));
  });
});
