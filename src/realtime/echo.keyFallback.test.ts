// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the panel does when Reverb refuses the app key the BACKEND told it to
 * use.
 *
 * Letting the server name the socket (`GET /realtime/config`) removed one
 * drift — a build shipping a stale key — and opened the mirror of it. That
 * endpoint reports `REVERB_APP_KEY` as set on the backend service, and nothing
 * on that path proves the Reverb service was started with the same string.
 * When it is not, every client connects with a key Reverb has never heard of,
 * is refused with Pusher 4001, and spends the session on polling — which is
 * exactly how a company block took tens of seconds to reach a screen instead of
 * arriving instantly, with no error anywhere except a console warning.
 *
 * So a refusal has to be acted on, not only narrated: drop the answer that
 * carried the key, reconnect on what the build ships with, and refuse to adopt
 * that key again for the rest of the session.
 */

const REFUSED = "key-the-server-advertises";
const BUNDLED = "key-this-build-ships";

type ErrorHandler = (err: unknown) => void;

const echoState = vi.hoisted(() => ({
  built: [] as string[],
  handlers: [] as ErrorHandler[],
  disconnects: 0,
}));

vi.mock("laravel-echo", () => ({
  default: class {
    connector: { pusher: { connection: { bind: (event: string, handler: ErrorHandler) => void } } };

    constructor(options: { key: string }) {
      echoState.built.push(options.key);
      this.connector = {
        pusher: {
          connection: {
            bind: (event: string, handler: ErrorHandler) => {
              if (event === "error") echoState.handlers.push(handler);
            },
          },
        },
      };
    }

    disconnect() {
      echoState.disconnects += 1;
    }
  },
}));

vi.mock("pusher-js", () => ({ default: class {} }));
vi.mock("@/infrastructure/AppConfig", () => ({
  AppConfig: { backendUrl: "https://backend.test", storageKeys: { token: "token" } },
}));
vi.mock("@/infrastructure/KeyValueStore", () => ({ keyValueStore: { get: async () => null } }));

/** The refusal Reverb sends when the app key is not one it was started with. */
const refusal = { error: { data: { code: 4001 } } };

const answerConfigWith = (key: string) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ enabled: true, key, host: "reverb.test", port: 443, scheme: "https" }),
    })),
  );
};

beforeEach(() => {
  vi.resetModules();
  echoState.built.length = 0;
  echoState.handlers.length = 0;
  echoState.disconnects = 0;
  localStorage.clear();
  vi.stubEnv("VITE_REVERB_KEY", BUNDLED);
  vi.stubEnv("VITE_REVERB_HOST", "reverb.test");
  vi.stubEnv("VITE_REVERB_PORT", "443");
  vi.stubEnv("VITE_REVERB_SCHEME", "https");
  globalThis.__cyberplace_echo__ = undefined;
  globalThis.__cyberplace_reverb_config__ = undefined;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a Reverb that refuses the advertised app key", () => {
  it("reconnects on the key this build ships and stops re-adopting the refused one", async () => {
    answerConfigWith(REFUSED);
    const echo = await import("./echo");

    await echo.primeRealtimeConfig();
    expect(echo.getEcho()).not.toBeNull();
    expect(echoState.built).toEqual([REFUSED]);

    const versionBefore = echo.realtimeVersion.current();

    // Reverb answers the only way it can when the app does not exist.
    echoState.handlers.forEach((handler) => handler(refusal));

    // The answer that carried the key is gone — including the copy that would
    // be adopted again on the next launch — and subscriptions are told to
    // re-attach.
    expect(localStorage.getItem("cp.realtimeConfig")).toBeNull();
    expect(echo.realtimeVersion.current()).toBeGreaterThan(versionBefore);

    // Rebuilt on the fallback rather than left dead.
    expect(echo.getEcho()).not.toBeNull();
    expect(echoState.built).toEqual([REFUSED, BUNDLED]);

    // A backend that still advertises the refused key must not be able to pull
    // the working connection back down.
    await echo.primeRealtimeConfig();
    expect(echoState.built).toEqual([REFUSED, BUNDLED]);
    expect(globalThis.__cyberplace_reverb_config__).toBeUndefined();
  });

  it("keeps a server key that a later answer changes to a different one", async () => {
    answerConfigWith(REFUSED);
    const echo = await import("./echo");

    await echo.primeRealtimeConfig();
    echo.getEcho();
    echoState.handlers.forEach((handler) => handler(refusal));
    echo.getEcho();
    expect(echoState.built).toEqual([REFUSED, BUNDLED]);

    // The deployment was fixed: a NEW key arrives, and it has not been refused,
    // so it is adopted like any other answer.
    answerConfigWith("key-after-the-fix");
    await echo.primeRealtimeConfig();
    echo.getEcho();

    expect(echoState.built).toEqual([REFUSED, BUNDLED, "key-after-the-fix"]);
  });

  it("does not churn the connection when the bundle carries the same refused key", async () => {
    vi.stubEnv("VITE_REVERB_KEY", REFUSED);
    answerConfigWith(REFUSED);
    const echo = await import("./echo");

    await echo.primeRealtimeConfig();
    echo.getEcho();
    expect(echoState.built).toEqual([REFUSED]);

    // Nothing else to try: rebuilding on the same string would only produce the
    // same refusal, so the client is left alone and the session polls.
    echoState.handlers.forEach((handler) => handler(refusal));
    echo.getEcho();

    expect(echoState.built).toEqual([REFUSED]);
    expect(echoState.disconnects).toBe(0);
  });
});
