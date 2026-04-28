import { describe, expect, it } from "vitest";
import { unwrapList, unwrapOne } from "./unwrap";

describe("unwrapList", () => {
  it("returns array as-is", async () => {
    expect(await unwrapList(Promise.resolve([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it("extracts data from envelope", async () => {
    expect(await unwrapList(Promise.resolve({ data: [4, 5] }))).toEqual([4, 5]);
  });

  it("returns empty array if envelope has no data", async () => {
    expect(await unwrapList(Promise.resolve({} as { data: number[] }))).toEqual([]);
  });
});

describe("unwrapOne", () => {
  it("uses keyHint when present", async () => {
    expect(await unwrapOne<{ id: number }>(Promise.resolve({ company: { id: 1 } }), "company"))
      .toEqual({ id: 1 });
  });

  it("falls back to data envelope", async () => {
    expect(await unwrapOne<{ id: number }>(Promise.resolve({ data: { id: 9 } })))
      .toEqual({ id: 9 });
  });

  it("picks first non-meta key", async () => {
    expect(await unwrapOne<{ x: number }>(Promise.resolve({ message: "ok", company: { x: 7 } })))
      .toEqual({ x: 7 });
  });

  it("returns raw if not object", async () => {
    expect(await unwrapOne<number>(Promise.resolve(42))).toBe(42);
  });
});
