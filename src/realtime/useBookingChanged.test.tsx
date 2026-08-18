// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBookingChanged } from "./useBookingChanged";

/**
 * The hook chooses between `echo.channel()` and `echo.private()`. Getting that
 * wrong fails in the worst possible way — quietly:
 *
 *  - private where public is meant → /broadcasting/auth rejects a channel the
 *    backend never authorises, and the panel simply receives nothing;
 *  - public where private is meant → it still works today, because the backend
 *    broadcasts to BOTH during the migration, and goes on leaking every
 *    booking on the platform to anyone holding the app key.
 *
 * The second one is why this test exists: no user-visible symptom, so nothing
 * else would catch it.
 */
const echo = vi.hoisted(() => {
  const channel = {
    listen: vi.fn(),
    stopListening: vi.fn(),
  };
  return {
    channel,
    publicNames: [] as string[],
    privateNames: [] as string[],
    client: {
      channel: (name: string) => {
        echo.publicNames.push(name);
        return channel;
      },
      private: (name: string) => {
        echo.privateNames.push(name);
        return channel;
      },
    },
  };
});
vi.mock("@/realtime/echo", () => ({ getEcho: () => echo.client }));
vi.mock("@/api/client", () => ({ apiCache: { invalidatePrefix: vi.fn() } }));

afterEach(() => {
  echo.publicNames.length = 0;
  echo.privateNames.length = 0;
  cleanup();
});

describe("useBookingChanged", () => {
  it("subscribes to a staff feed through echo.private()", () => {
    renderHook(() => useBookingChanged("bookings.global", () => {}, true));

    expect(echo.privateNames).toEqual(["bookings.global"]);
    expect(echo.publicNames).toEqual([]);
  });

  it("subscribes to the branch feed through echo.channel()", () => {
    renderHook(() => useBookingChanged("branch.7", () => {}, false));

    expect(echo.publicNames).toEqual(["branch.7"]);
    expect(echo.privateNames).toEqual([]);
  });

  it("stays public when no flag is passed", () => {
    renderHook(() => useBookingChanged("branch.7", () => {}));

    expect(echo.publicNames).toEqual(["branch.7"]);
  });

  it("subscribes to nothing when there is no channel", () => {
    renderHook(() => useBookingChanged(null, () => {}, true));

    expect(echo.publicNames).toEqual([]);
    expect(echo.privateNames).toEqual([]);
  });
});
