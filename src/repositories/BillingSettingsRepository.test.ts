import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The two reads of a branch's billing policy, and why there are two.
 *
 * `get()` is lenient: a missing endpoint (and, by `isMissingEndpoint`, a
 * network failure) reads as defaults — fine for a screen that only shows the
 * joystick fee. `getForEdit()` is strict: the Prices page PUTs the whole policy
 * back, so a default read there would be saved over the real one.
 */

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/joystickPrices", async (orig) => ({
  ...(await orig<typeof import("@/api/joystickPrices")>()),
  apiGetBillingSettings: (...a: unknown[]) => api.get(...a),
}));

import { billingSettingsRepository } from "./BillingSettingsRepository";

const networkDown = () => Object.assign(new Error("network down"), { status: 0 });
const policy = { branch_id: 7, money_rounding_step: 100, money_rounding_mode: "up", joystick_price: 500 };

beforeEach(() => { api.get.mockReset(); });

describe("BillingSettingsRepository", () => {
  test("getForEdit returns the server's policy", async () => {
    api.get.mockResolvedValue({ settings: policy });
    await expect(billingSettingsRepository.getForEdit(7)).resolves.toEqual(policy);
  });

  test("getForEdit THROWS on a network failure — never defaults", async () => {
    api.get.mockImplementation(async () => { throw networkDown(); });
    let caught: unknown = null;
    try { await billingSettingsRepository.getForEdit(7); } catch (e) { caught = e; }
    expect((caught as Error | null)?.message).toBe("network down");
  });

  test("get() stays lenient for read-only screens", async () => {
    api.get.mockImplementation(async () => { throw networkDown(); });
    const read = await billingSettingsRepository.get(7);
    expect(read).toMatchObject({ branch_id: 7, joystick_price: null });
  });
});
