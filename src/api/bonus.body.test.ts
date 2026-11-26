import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The owner's hand on a card and the visit ratings (2026-11-26/27) send their
 * fields as an object: the client encodes the body once. A string here would
 * reach the server encoded twice and be refused (QA 2026-11-27).
 */
const client = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/api/client", () => ({ request: client.request }));

import { apiFreezeBonusAccount, apiRateBonusAccount, apiSetBonusRank } from "./bonus";

beforeEach(() => { client.request.mockReset(); client.request.mockResolvedValue({ account: {} }); });

describe("bonus card bodies", () => {
  test("freeze, rank and rating send plain objects", async () => {
    await apiFreezeBonusAccount(7, 4, true);
    await apiSetBonusRank(7, 4, "pro");
    await apiRateBonusAccount(7, 4, { stars: 1, comment: "Грубил", gift: "500" });
    await apiRateBonusAccount(7, 4, { skip: true });
    expect(client.request.mock.calls.map((c) => [c[0], c[1].method, c[1].body])).toEqual([
      ["/branches/7/bonus-accounts/4/freeze", "PUT", { frozen: true }],
      ["/branches/7/bonus-accounts/4/rank", "PUT", { rank: "pro" }],
      ["/branches/7/bonus-accounts/4/rating", "PUT", { stars: 1, comment: "Грубил", gift: "500" }],
      ["/branches/7/bonus-accounts/4/rating", "PUT", { skip: true }],
    ]);
  });
});
