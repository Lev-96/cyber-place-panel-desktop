import { describe, expect, test } from "vitest";
import { isPermanentRefusal } from "../../electron/ps5/playactor";

/**
 * Which refusals are worth asking about again.
 *
 * Measured on a real console: the first session request is sometimes refused
 * with a transient error and the next one, seconds later, is accepted — the
 * console then sleeps within five. Treating that first refusal as the answer is
 * what made "press No and nothing happens" true, because the panel then sat out
 * its backoff while the console was perfectly willing to be asked again.
 *
 * The two that ARE final are equally important: a console holding a Remote Play
 * session refuses for as long as something on it holds one — three minutes of
 * silence did not change it — and an unpaired console will not pair itself.
 */
describe("asking a console to sleep again", () => {
  test("a transient refusal is worth retrying", () => {
    expect(isPermanentRefusal("FAILED")).toBe(false);
    expect(isPermanentRefusal("UNREACHABLE")).toBe(false);
    expect(isPermanentRefusal(undefined)).toBe(false);
  });

  test("a console that says it is busy is asked again anyway", () => {
    // It sticks when something really holds the console — three minutes of
    // silence did not shift it — but with the socket closed politely it has
    // also been seen to clear on the very next attempt. Eight seconds of
    // asking again is cheaper than the times it would have worked.
    expect(isPermanentRefusal("IN_USE")).toBe(false);
  });

  test("neither is one that has not been paired", () => {
    expect(isPermanentRefusal("REJECTED")).toBe(true);
  });
});
