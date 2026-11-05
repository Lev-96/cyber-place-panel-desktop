import { describe, expect, test } from "vitest";
import { readHidden } from "./useHiddenParts";

const PARTS = ["free", "rate", "plan"] as const;

describe("readHidden", () => {
  test("reads the parts it knows, in their own order", () => {
    expect(readHidden({ v: 1, hidden: ["plan", "free"] }, PARTS)).toEqual(["free", "plan"]);
  });

  test("never hides a part it does not know", () => {
    expect(readHidden({ v: 1, hidden: ["start", "summary", "plan"] }, PARTS)).toEqual(["plan"]);
  });

  test.each([[null], [undefined], ["plan"], [42], [{}], [{ v: 2, hidden: ["plan"] }], [{ v: 1, hidden: "plan" }]])(
    "%j hides nothing", (stored) => {
      expect(readHidden(stored, PARTS)).toEqual([]);
    },
  );
});
