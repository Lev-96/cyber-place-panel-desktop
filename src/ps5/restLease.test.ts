import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The panel's side of "one panel rests a console": the backend's answer read
 * into granted / elsewhere / unknown, and a slow or missing backend never
 * holding a Stop for more than a moment.
 */

const claimApi = vi.fn();
const releaseApi = vi.fn();
vi.mock("@/api/ps5", () => ({
  apiClaimRestLease: (...a: unknown[]) => claimApi(...a),
  apiReleaseRestLease: (...a: unknown[]) => releaseApi(...a),
  apiReportUnexpectedWake: vi.fn(),
}));

const { claimRestLease, releaseRestLease, REST_CLAIM_TIMEOUT_MS } = await import("./useConsoleControl");

beforeEach(() => {
  claimApi.mockReset();
  releaseApi.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("claimRestLease", () => {
  test("granted and refused are the backend's answer", async () => {
    claimApi.mockResolvedValueOnce({ granted: true, lease_seconds: 75 });
    await expect(claimRestLease(7)).resolves.toBe("granted");
    claimApi.mockResolvedValueOnce({ granted: false, lease_seconds: 75 });
    await expect(claimRestLease(7)).resolves.toBe("elsewhere");
  });

  test("the same holder id is sent every time in one run, and it is a uuid", async () => {
    claimApi.mockResolvedValue({ granted: true });
    await claimRestLease(1);
    await claimRestLease(2);
    const [first, second] = claimApi.mock.calls;
    expect(first[0]).toBe(1);
    expect(second[1]).toBe(first[1]);
    expect(first[1]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("an older backend (404) or a network failure: could not ask", async () => {
    claimApi.mockRejectedValueOnce(Object.assign(new Error("Not Found"), { status: 404 }));
    await expect(claimRestLease(7)).resolves.toBe("unknown");
    claimApi.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(claimRestLease(7)).resolves.toBe("unknown");
    claimApi.mockResolvedValueOnce(null);
    await expect(claimRestLease(7)).resolves.toBe("unknown");
  });

  test("a backend that does not answer in time does not hold the Stop", async () => {
    vi.useFakeTimers();
    claimApi.mockImplementationOnce(() => new Promise(() => {}));
    const answer = claimRestLease(7);
    await vi.advanceTimersByTimeAsync(REST_CLAIM_TIMEOUT_MS);
    await expect(answer).resolves.toBe("unknown");
  });
});

describe("releaseRestLease", () => {
  test("gives the console back under the same holder, and a failure is swallowed", async () => {
    claimApi.mockResolvedValue({ granted: true });
    await claimRestLease(3);
    releaseApi.mockRejectedValueOnce(new Error("offline"));
    expect(() => releaseRestLease(3)).not.toThrow();
    expect(releaseApi).toHaveBeenCalledWith(3, claimApi.mock.calls[0][1]);
  });
});

describe("the lease path", () => {
  test("drops no cached list: it is asked several times per Stop", async () => {
    const { invalidationTargets } = await import("@/api/httpCache");
    expect(invalidationTargets("/ps5-rest-lease/116")).toEqual(["/ps5-rest-lease"]);
  });
});
