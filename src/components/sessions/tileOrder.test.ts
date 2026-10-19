import { describe, expect, test } from "vitest";
import { reconcileOrder } from "./tileOrder";

describe("reconcileOrder", () => {
  test("first load: no local order yet → the server's order (no empty frame)", () => {
    expect(reconcileOrder([], [3, 1, 2])).toEqual([3, 1, 2]);
  });
  test("keeps a dragged order, appends new devices, drops removed ones", () => {
    expect(reconcileOrder([2, 1, 3], [1, 2, 4])).toEqual([2, 1, 4]);
  });
  test("no devices → nothing", () => {
    expect(reconcileOrder([1, 2], [])).toEqual([]);
  });
});
