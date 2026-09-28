import { describe, expect, test } from "vitest";
import { sessionAmountAt, sessionCurrentHourlyRate, sessionJoysticksTotalAt } from "./sessionAmount";
import type { ISessionApi } from "@/types/sessions";
import live from "./__fixtures__/live-parity.json";

/**
 * The panel's arithmetic against the server's, on payloads the server actually
 * sent.
 *
 * ## Why this file exists
 *
 * The card cannot ask the server every second, so it mirrors the bill between
 * polls. Two implementations of one money rule is a thing this project accepts
 * deliberately and has to keep honest — and the way it went wrong was not a
 * formula at all: the listing simply did not carry `is_hourly`, so the mirror
 * read every hourly pad as a one-off fee and a tile quoted 500 for a pad the
 * server was billing at 0.69.
 *
 * Unit tests did not catch it because their fixtures set the field by hand. A
 * fixture richer than the payload proves nothing about the payload. So these
 * samples are captured from a REAL backend on a real MySQL, over HTTP, across a
 * full timeline: a fresh seat, a pad handed out, a second one, each handed back,
 * under the hourly strategy, under the fee strategy, and on a venue that rounds
 * to 100.
 *
 * Re-capture with `scratchpad/capture.py` against a local server if the payload
 * shape changes; do not hand-edit the fixture.
 *
 * ## The tolerance, and why it still discriminates
 *
 * The server priced at its own instant and the capture recorded `at` a moment
 * later, so the two differ by a fraction of a second of clock. The tolerance is
 * therefore stated in the only unit that means anything here — SECONDS of the
 * seat's effective rate — rather than as a figure in drams that would be
 * generous on a cheap seat and impossible on an expensive one.
 *
 * Two seconds is far more than the drift and far less than the bug: reading a
 * rate as a fee is wrong by the whole rate, 500 against 0.69, which is roughly
 * an hour of clock. The gap between what this allows and what it catches is
 * about three orders of magnitude.
 */

/** Two seconds of whatever this seat currently costs per hour. */
const driftAllowance = (session: ISessionApi): number =>
  Math.max(0.05, (sessionCurrentHourlyRate(session) * 2) / 3600);

interface Sample {
  label: string;
  at: number;
  session: ISessionApi;
  server_total: number;
  server_joysticks_total: number;
  server_time_cost: number;
}

const samples = live.samples as unknown as Sample[];

describe("the card's arithmetic reproduces the server's, on real payloads", () => {
  test("the fixture is a real capture across every configuration", () => {
    expect(samples.length).toBeGreaterThanOrEqual(18);
    for (const strategy of ["hourly", "fixed", "hourly, rounds to 100"]) {
      expect(samples.some((s) => s.label.startsWith(strategy))).toBe(true);
    }
    // A capture that lost the flag would make every assertion below vacuous,
    // which is exactly the hole this file was written for.
    const withPads = samples.filter((s) => (s.session.joysticks ?? []).length > 0);
    expect(withPads.length).toBeGreaterThan(0);
    for (const s of withPads) {
      for (const pad of s.session.joysticks ?? []) {
        expect(pad).toHaveProperty("is_hourly");
      }
    }
  });

  test.each(samples.map((s) => [s.label, s] as const))(
    "%s — the total the card computes is the total the server charges",
    (_label, sample) => {
      const mirrored = sessionAmountAt(sample.session, sample.at);

      expect(Math.abs(mirrored - sample.server_total))
        .toBeLessThanOrEqual(driftAllowance(sample.session));
    },
  );

  test.each(samples.map((s) => [s.label, s] as const))(
    "%s — and the pads on their own agree too",
    (_label, sample) => {
      const mirrored = sessionJoysticksTotalAt(sample.session, sample.at);

      expect(Math.abs(mirrored - sample.server_joysticks_total))
        .toBeLessThanOrEqual(driftAllowance(sample.session));
    },
  );

  /**
   * The specific failure, named: under the hourly strategy a pad's share of a
   * few seconds is pennies, and reading its rate as a fee gives the rate.
   */
  test("an hourly pad is never counted at its whole rate", () => {
    const hourly = samples.filter(
      (s) => s.label.startsWith("hourly /") && (s.session.joysticks ?? []).some((j) => j.is_hourly),
    );
    expect(hourly.length).toBeGreaterThan(0);

    for (const s of hourly) {
      const mirrored = sessionJoysticksTotalAt(s.session, s.at);
      // The rate itself, which is what the broken reading produced.
      expect(mirrored).toBeLessThan(100);
      expect(s.server_joysticks_total).toBeLessThan(100);
    }
  });

  /** …and under the fee strategy it IS the whole fee, which must not regress. */
  test("a fee pad is counted at its whole fee", () => {
    const fixed = samples.filter(
      (s) => s.label.startsWith("fixed /") && (s.session.joysticks ?? []).length > 0,
    );
    expect(fixed.length).toBeGreaterThan(0);

    for (const s of fixed) {
      expect(sessionJoysticksTotalAt(s.session, s.at)).toBeCloseTo(s.server_joysticks_total, 2);
      expect(s.server_joysticks_total).toBeGreaterThanOrEqual(500);
    }
  });

  /**
   * The venue that rounds. The server rounds the bill once, on the subtotal,
   * and these samples are small enough that rounding to the nearest 100 takes
   * them to zero — a figure the card could not reach at all before it was given
   * the policy.
   */
  test("a rounding venue's card lands where its receipt does", () => {
    const rounding = samples.filter((s) => s.label.startsWith("hourly, rounds to 100"));
    expect(rounding.length).toBeGreaterThan(0);

    for (const s of rounding) {
      expect(s.session.rounding_step).toBe(100);
      expect(sessionAmountAt(s.session, s.at)).toBe(s.server_total);
    }
  });
});
