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
 * The ones that are NOT worth asking about again are so for two different
 * reasons: an unpaired console will not pair itself, and a console that cannot
 * be found makes every retry pay for a full discovery that is guaranteed to
 * come back empty.
 */
describe("asking a console to sleep again", () => {
  test("a transient refusal is worth retrying", () => {
    expect(isPermanentRefusal("FAILED")).toBe(false);
    expect(isPermanentRefusal(undefined)).toBe(false);
  });

  test("a console that cannot be found is not asked again in this call", () => {
    // This one used to be retried, and the cost was measured: a rest aimed at a
    // console that had left the network took 144 416 ms to fail, because each
    // attempt waits out a full discovery and absence is precisely the case
    // where every one of them does. Nothing else can be sent to that console
    // while a command is in flight, so those two and a half minutes were two
    // and a half minutes in which pressing Start woke nothing.
    //
    // Retrying here buys nothing that is not already bought: the monitor
    // re-reads the console every 1.5-10 seconds and re-issues from what it
    // then sees, which is a better-informed retry than this loop's.
    expect(isPermanentRefusal("UNREACHABLE")).toBe(true);
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
