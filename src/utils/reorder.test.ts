import { describe, expect, it } from "vitest";
import { dropSideOf, moveOnto } from "./reorder";

/** Dropping an item ON another puts it in that item's slot (2026-10-11). */
const L = ["A", "B", "C", "D", "E"] as const;
const move = (from: string, target: string | null) => moveOnto(L, from, target).join("");

describe("moveOnto", () => {
  it("first to last, and last to first", () => {
    expect(move("A", "E")).toBe("BCDEA");
    expect(move("E", "A")).toBe("EABCD");
  });

  it("first and last into the middle", () => {
    expect(move("A", "C")).toBe("BCADE");
    expect(move("E", "C")).toBe("ABECD");
  });

  it("one step down and one step up", () => {
    expect(move("B", "C")).toBe("ACBDE");
    expect(move("C", "B")).toBe("ACBDE");
    expect(move("D", "E")).toBe("ABCED");
    expect(move("B", "A")).toBe("BACDE");
  });

  it("several steps in both directions", () => {
    expect(move("B", "E")).toBe("ACDEB");
    expect(move("D", "A")).toBe("DABCE");
  });

  it("onto itself changes nothing", () => {
    expect(move("C", "C")).toBe("ABCDE");
  });

  it("no target, or a target not in the list: to the end", () => {
    expect(move("A", null)).toBe("BCDEA");
    expect(move("A", "Z")).toBe("BCDEA");
  });

  it("an item not yet in the list is inserted in front of the target", () => {
    expect(move("Z", "C")).toBe("ABZCDE");
  });

  it("one, two and no items", () => {
    expect(moveOnto(["A"], "A", "A")).toEqual(["A"]);
    expect(moveOnto(["A", "B"], "A", "B")).toEqual(["B", "A"]);
    expect(moveOnto(["A", "B"], "B", "A")).toEqual(["B", "A"]);
    expect(moveOnto([] as string[], "A", null)).toEqual(["A"]);
  });

  it("never mutates its input", () => {
    const list = ["A", "B", "C"];
    moveOnto(list, "A", "C");
    expect(list).toEqual(["A", "B", "C"]);
  });

  it("every pair: the item lands in the target's slot, nothing lost or doubled", () => {
    for (const from of L) for (const target of L) {
      const out = moveOnto(L, from, target);
      expect(out.indexOf(from)).toBe(L.indexOf(target));
      expect([...out].sort()).toEqual([...L]);
      // The rest keep their relative order.
      expect(out.filter((x) => x !== from)).toEqual(L.filter((x) => x !== from));
    }
  });

  it("repeated moves always start from the current order", () => {
    let list: string[] = [...L];
    list = moveOnto(list, "A", "E"); // BCDEA
    list = moveOnto(list, "E", "B"); // EBCDA
    list = moveOnto(list, "B", "A"); // ECDAB
    expect(list.join("")).toBe("ECDAB");
    expect([...list].sort()).toEqual([...L]);
  });
});

describe("dropSideOf", () => {
  it("after when the drop moves the item down, before when up", () => {
    expect(dropSideOf(L, "A", "E")).toBe("after");
    expect(dropSideOf(L, "B", "C")).toBe("after");
    expect(dropSideOf(L, "E", "A")).toBe("before");
    expect(dropSideOf(L, "C", "B")).toBe("before");
  });

  it("agrees with where moveOnto puts the item", () => {
    for (const from of L) for (const target of L) {
      const side = dropSideOf(L, from, target);
      if (side === null) continue;
      const out = moveOnto(L, from, target);
      const neighbour = out.indexOf(from) + (side === "after" ? -1 : 1);
      expect(out[neighbour]).toBe(target);
    }
  });

  it("nothing to mark: no drag, over itself, a target not listed", () => {
    expect(dropSideOf(L, null, "A")).toBeNull();
    expect(dropSideOf(L, "A", "A")).toBeNull();
    expect(dropSideOf(L, "A", "Z")).toBeNull();
  });
});
