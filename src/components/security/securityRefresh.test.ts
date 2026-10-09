import { describe, expect, test } from "vitest";
import { refreshAll, type SecurityReload } from "./securityRefresh";

/** How one Refresh round is judged (2026-10-09). */
describe("refreshAll", () => {
  test("succeeds only when every registered list answered", async () => {
    expect(await refreshAll(new Set<SecurityReload>([async () => true, async () => true]))).toBe(true);
    expect(await refreshAll(new Set<SecurityReload>([async () => true, async () => false]))).toBe(false);
  });

  test("calls each registered reload exactly once", async () => {
    let a = 0;
    let b = 0;
    await refreshAll(new Set<SecurityReload>([async () => { a += 1; return true; }, async () => { b += 1; return true; }]));
    expect([a, b]).toEqual([1, 1]);
  });

  test("a list unmounted mid-round (tab switched) is not a failure", async () => {
    const registered = new Set<SecurityReload>();
    const gone: SecurityReload = async () => { registered.delete(gone); return false; };
    registered.add(gone);
    registered.add(async () => true);
    expect(await refreshAll(registered)).toBe(true);
  });

  test("a reload that throws counts as failed and does not break the round", async () => {
    expect(await refreshAll(new Set<SecurityReload>([() => Promise.reject(new Error("x")), async () => true]))).toBe(false);
  });

  test("nothing registered is a successful no-op", async () => {
    expect(await refreshAll(new Set())).toBe(true);
  });
});
