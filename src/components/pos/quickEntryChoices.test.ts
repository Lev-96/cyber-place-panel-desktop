import { describe, expect, test } from "vitest";
import type { IResolvedItems } from "@/api/sessions";
import { choiceKey, pendingPicks, pruneChoices, removeTypedLine, toChoicePayload } from "./quickEntryChoices";

const line = (over: Record<string, unknown>) => ({
  raw: "Cola 5", product_id: null, name: null, price: null, qty: 5, line_total: null,
  error: "ambiguous", candidates: [], status: "ambiguous",
  options: [
    { product_id: 1, name: "Coca Cola", price: 500, line_total: 2500 },
    { product_id: 2, name: "Coca Cola can", price: 700, line_total: 3500 },
  ],
  ...over,
});
const resolved = (lines: unknown[]): IResolvedItems => ({ lines, items: [], total: 0, ok: false } as IResolvedItems);

describe("quickEntryChoices", () => {
  test("a pick is keyed by the line AND its text", () => {
    expect(choiceKey(0, "Cola 5")).toBe("0:Cola 5");
    expect(choiceKey(0, "Cola 5")).not.toBe(choiceKey(1, "Cola 5"));
  });

  test("the payload is in line order, and a text with a colon survives", () => {
    expect(toChoicePayload({ "2:Tea: green 1": 9, "0:Cola 5": 2 })).toEqual([
      { line: 0, raw: "Cola 5", product_id: 2 },
      { line: 2, raw: "Tea: green 1", product_id: 9 },
    ]);
  });

  test("a pick stands while its line is ambiguous with that option", () => {
    const choices = { "0:Cola 5": 2 };
    expect(pruneChoices(choices, resolved([line({})]))).toBe(choices);
  });

  test("a pick stands once the server resolved the line to it", () => {
    const choices = { "0:Cola 5": 2 };
    expect(pruneChoices(choices, resolved([line({ status: "matched", product_id: 2, error: null })]))).toBe(choices);
  });

  test("a pick for a line whose text changed is dropped", () => {
    expect(pruneChoices({ "0:Cola 5": 2 }, resolved([line({ raw: "Cola 7" })]))).toEqual({});
  });

  test("a pick of a product no longer among the options is dropped", () => {
    expect(pruneChoices({ "0:Cola 5": 9 }, resolved([line({})]))).toEqual({});
  });

  test("a pick for a line that is gone is dropped, the others kept", () => {
    expect(pruneChoices({ "0:Cola 5": 1, "3:Cola 2": 2 }, resolved([line({})]))).toEqual({ "0:Cola 5": 1 });
  });

  test("pending picks count only the ambiguous lines", () => {
    expect(pendingPicks(resolved([line({}), line({ status: "matched" }), line({ status: "unmatched" })]))).toBe(1);
    expect(pendingPicks(null)).toBe(0);
  });
});

describe("removeTypedLine — taking one line out of the draft", () => {
  test("removes the n-th NON-BLANK line, as the server counts them, and nothing else", () => {
    const text = "cola 5\n\n  20 lays  \r\ncola 2\n";
    const out = removeTypedLine(text, {}, 1);
    expect(out.text).toBe("cola 5\n\ncola 2\n");
  });

  test("drops the removed line's pick and moves the later picks up with their lines", () => {
    const choices = { [choiceKey(0, "cola 5")]: 21, [choiceKey(1, "cola 3")]: 20, [choiceKey(2, "cola 2")]: 22 };
    const out = removeTypedLine("cola 5\ncola 3\ncola 2", choices, 1);
    expect(out.text).toBe("cola 5\ncola 2");
    expect(out.choices).toEqual({ [choiceKey(0, "cola 5")]: 21, [choiceKey(1, "cola 2")]: 22 });
  });

  test("a line of only a no-break space is a line to the server (PHP trim keeps it), so it is counted", () => {
    const out = removeTypedLine("cola 5\n\u00a0\ncola 2", {}, 2);
    expect(out.text).toBe("cola 5\n\u00a0");
  });

  test("an index past the end changes nothing", () => {
    const choices = { [choiceKey(0, "cola 5")]: 21 };
    const out = removeTypedLine("cola 5", choices, 3);
    expect(out.text).toBe("cola 5");
    expect(out.choices).toBe(choices);
  });

  test("the last line removed leaves an empty draft", () => {
    expect(removeTypedLine("  cola 5  ", {}, 0).text).toBe("");
  });
});
