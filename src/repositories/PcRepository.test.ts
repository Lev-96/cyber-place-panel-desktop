import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the Computers section is allowed to contain.
 *
 * Every place owns a device — `gaming_sessions.pc_id` is NOT NULL, so a place
 * without one cannot be billed — but only an agent-backed one is a computer. A
 * console's device has no agent, no pairing token and no MAC; listing it here
 * showed the operator a row with nothing to do and a Delete button that would
 * take a working PlayStation place with it.
 *
 * The narrowing lives in the request, not in a filter after it, so the screen
 * cannot accidentally render a console while a fetch is in flight. The sessions
 * board asks through its own repository and must keep getting everything —
 * that half is pinned in SessionRepository's own call, which passes no kind.
 */
const api = vi.hoisted(() => ({
  list: vi.fn(async () => ({ data: [] })),
}));

vi.mock("@/api/pcs", () => ({
  apiListPcsForBranch: api.list,
  apiCreatePc: vi.fn(),
  apiDeletePc: vi.fn(),
  apiUpdatePc: vi.fn(),
  apiRotatePcToken: vi.fn(),
}));

beforeEach(() => {
  api.list.mockClear();
});

describe("PcRepository.listByBranch", () => {
  it("asks for computers only", async () => {
    const { pcRepository } = await import("./PcRepository");

    await pcRepository.listByBranch(7);

    expect(api.list).toHaveBeenCalledWith(7, "pc");
  });

  it("returns an empty list rather than throwing when the request fails", async () => {
    api.list.mockRejectedValueOnce(new Error("offline"));
    const { pcRepository } = await import("./PcRepository");

    // The screen renders "no computers yet" instead of an error page — the
    // existing `orFallback` behaviour, kept while adding the kind filter.
    await expect(pcRepository.listByBranch(7)).resolves.toEqual([]);
  });
});
