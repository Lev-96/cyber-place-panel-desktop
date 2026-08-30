import { describe, expect, test } from "vitest";
import { accessVersion } from "./accessVersion";

/**
 * The signal that makes an open screen re-read itself after an administrator
 * blocks or unblocks something. Small, but the bug it closes is not: without
 * it a reopened branch keeps rendering its "blocked — read only" shape until
 * the operator restarts the app, because nothing on that screen had any reason
 * to ask the server again.
 */
describe("accessVersion", () => {
  test("every change moves the counter forward", () => {
    const before = accessVersion.current();
    accessVersion.bump();
    accessVersion.bump();

    expect(accessVersion.current()).toBe(before + 2);
  });

  test("subscribers hear each change with the new value", () => {
    const seen: number[] = [];
    const stop = accessVersion.subscribe((v) => seen.push(v));

    accessVersion.bump();
    accessVersion.bump();
    stop();
    accessVersion.bump();

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0] + 1);
  });

  test("one throwing subscriber does not silence the others", () => {
    let reached = false;
    const stopA = accessVersion.subscribe(() => { throw new Error("boom"); });
    const stopB = accessVersion.subscribe(() => { reached = true; });

    accessVersion.bump();
    stopA(); stopB();

    expect(reached).toBe(true);
  });
});
