import { describe, expect, test } from "vitest";
import { sessionAmountAt } from "./sessionAmount";
import type { ISessionApi } from "@/types/sessions";
import capture from "./__fixtures__/server-parity-2026-11-16.json";

/**
 * The tile's figure IS the server's, to the cent, at every instant
 * (2026-11-16, billing audit «Tile»).
 *
 * Every board row here is what `GET /sessions?status=active` answered, and
 * every figure what `GET /sessions/{id}/preview` answered at that instant —
 * captured by the backend's own hand-figure test
 * (`SessionBillHandFiguresTest::test_t_tile_fixtures`, run with
 * `BILL_TILE_FIXTURES=<dir>`). Re-capture after a payload change; never edit
 * a figure by hand. The row is the one read at the first instant, exactly as
 * the tile holds it between polls, and each later instant is the tile ticking.
 *
 * No tolerance: equality to the cent. The audit found 15 of 210 instants off,
 * five of them by a whole rounding step — pads summed before rounding, the
 * package rate, a float (833.33 × 5400 / 3600 = 1249.995 read 1249.99), and
 * whole drams on a step-0 branch.
 */
interface Instant {
  at: number;
  at_ms: number;
  server_total: number;
  server_subtotal: number;
}
interface Case {
  case: string;
  board: ISessionApi;
  instants: Instant[];
}

const cases = (capture as unknown as { cases: Case[] }).cases;
const rows = cases.flatMap((c) => c.instants.map((i) => [`${c.case} @${i.at}s`, c.board, i] as const));

describe("the tile reproduces the server's bill exactly", () => {
  test("the capture covers every shape the bill has, under every rounding", () => {
    const shapes = new Set(cases.map((c) => c.case.split("|")[0]));
    for (const t of ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "T13"]) {
      expect(shapes.has(t)).toBe(true);
    }
    const policies = new Set(cases.map((c) => c.case.split("|")[2]));
    expect([...policies].sort()).toEqual(["100d", "100n", "100u", "1n", "none"]);
    expect(rows.length).toBe(350);
    // The new payload keys reached the capture, so the cases that need them test them.
    expect(cases.some((c) => (c.board.plan_period_ends ?? []).length > 0)).toBe(true);
    expect(cases.some((c) => c.board.rate_seconds === 10800 && Number(c.board.rate_price) === 2500)).toBe(true);
    expect(cases.some((c) => (c.board.joysticks ?? []).length === 2)).toBe(true);
  });

  test.each(rows)("%s — the figure on the tile is the receipt's", (_label, board, instant) => {
    expect(sessionAmountAt(board, instant.at_ms)).toBe(Number(instant.server_total));
  });

  test.each(rows)("%s — and before the branch's step too", (_label, board, instant) => {
    expect(sessionAmountAt({ ...board, rounding_step: 0 }, instant.at_ms)).toBe(Number(instant.server_subtotal));
  });

  /** The five instants the audit found a whole rounding step apart, by hand. */
  test.each([
    ["T2|two-pads|100n", 1353, 800],   // 375.8333… + 2 × 187.0833… = 750.00 → 800
    ["T2|two-pads|100n", 2253, 1300],  // 625.8333… + 2 × 312.0833… = 1250.00 → 1300
    ["T2|two-pads|100d", 2703, 1500],  // 750.8333… + 2 × 374.5833… = 1500.00 → 1500
    ["T3|rate833.33|100n", 5400, 1300], // 833.33 × 1.5 = 1249.995 → 1250.00 → 1300
    ["T8|deal-vip-min120|100d", 10800, 2500], // 1666.666… + (2500 − 1666.666…) = 2500.00
  ])("%s @%ss is %s", (name, at, figure) => {
    const c = cases.find((x) => x.case === name);
    const instant = c?.instants.find((i) => i.at === at);
    expect(instant).toBeDefined();
    expect(Number(instant!.server_total)).toBe(figure);
    expect(sessionAmountAt(c!.board, instant!.at_ms)).toBe(figure);
  });
});
