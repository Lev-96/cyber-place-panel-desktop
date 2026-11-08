import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * A console whose user has a PS5 login passcode: said as such, asked once.
 *
 * It used to be retried three times per Stop and read as "in use", because the
 * first attempt's open socket made every later one refused (loginLeak.test.ts).
 */

/** What the console answers this test; the mock itself never changes. */
let refusal = "Error[1] PASSCODE_IS_NEEDED";
/** The config each connection was opened with (the login passcode rides in it). */
const configs: unknown[] = [];
const openConnection = vi.fn(async (config?: unknown) => { configs.push(config); throw new Error(refusal); });
vi.mock("playactor/dist/device/pending", () => ({
  PendingDevice: class {
    discover = async () => ({ status: "AWAKE" });
    openConnection = openConnection;
  },
}));
vi.mock("playactor/dist/credentials", () => ({ CredentialManager: class {} }));

const { standby, isPermanentRefusal } = await import("../../electron/ps5/playactor");
const keys = {} as never;

beforeEach(() => {
  configs.length = 0;
  openConnection.mockClear();
  refusal = "Error[1] PASSCODE_IS_NEEDED";
});

describe("a console that asks for its user's login passcode", () => {
  test("is answered PASSCODE_REQUIRED, after one attempt", async () => {
    const result = await standby("192.168.1.16", keys, "BC3329D4318D");

    expect(result.code).toBe("PASSCODE_REQUIRED");
    expect(openConnection).toHaveBeenCalledTimes(1);
  });

  test("is a refusal the retries do not change", () => {
    expect(isPermanentRefusal("PASSCODE_REQUIRED")).toBe(true);
    expect(isPermanentRefusal("IN_USE")).toBe(false);
  });

  test("'in use' is still 'in use', and still retried", async () => {
    vi.useFakeTimers();
    refusal = "Registration error: 403: Forbidden: Remote is already in use";

    const result = standby("192.168.1.16", keys, "BC3329D4318D");
    await vi.runAllTimersAsync();

    expect((await result).code).toBe("IN_USE");
    expect(openConnection).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe("a saved login passcode", () => {
  const vault = (passcode: string | null) => ({ readPasscode: (hostId: string) => (hostId === "BC3329D4318D" ? passcode : null) }) as never;

  test("is given to the console's login", async () => {
    await standby("192.168.1.16", vault("1234"), "BC3329D4318D");
    expect(configs[0]).toEqual({ login: { passCode: "1234" } });
  });

  test("none saved: the login is opened exactly as before", async () => {
    await standby("192.168.1.16", vault(null), "BC3329D4318D");
    expect(configs[0]).toBeUndefined();
  });

  test("it is per console: another console's code is never sent", async () => {
    await standby("192.168.1.20", vault("1234"), "70662A44452B");
    expect(configs[0]).toBeUndefined();
  });

  test("a code the console refuses is said as such, and not retried", async () => {
    refusal = "Error[1] PASSCODE_IS_UNMATCHED";
    const result = await standby("192.168.1.16", vault("9999"), "BC3329D4318D");
    expect(result.code).toBe("PASSCODE_WRONG");
    expect(openConnection).toHaveBeenCalledTimes(1);
  });
});
