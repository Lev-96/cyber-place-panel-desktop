// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { accessVersion } from "./accessVersion";
import BranchVisibilityGuard from "./BranchVisibilityGuard";

/**
 * The panel's half of "a venue closed somewhere else".
 *
 * A block applied on another administrator's machine reaches this one only
 * through the catalogue feed. What has to hold:
 *
 *  - it joins the PUBLIC `branches` channel — the same one the mobile app
 *    listens to, so the two clients cannot disagree about which venues are
 *    open, and public because a guest token cannot authorise a private one;
 *  - an event drops the response cache BEFORE bumping the version, or the
 *    re-read it triggers is answered from entries recorded under the old state;
 *  - unmounting stops listening, so a remount does not handle each event twice.
 */

const cache = vi.hoisted(() => ({ cleared: 0 }));
vi.mock("@/api/client", () => ({ apiCache: { clear: () => { cache.cleared += 1; } } }));

const echo = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();
  return {
    listeners,
    publicChannels: [] as string[],
    privateChannels: [] as string[],
    client: {
      channel: (name: string) => {
        echo.publicChannels.push(name);
        return {
          listen: (event: string, cb: (payload: unknown) => void) => { echo.listeners.set(event, cb); },
          stopListening: (event: string) => { echo.listeners.delete(event); },
        };
      },
      private: (name: string) => {
        echo.privateChannels.push(name);
        return {
          listen: (event: string, cb: (payload: unknown) => void) => { echo.listeners.set(event, cb); },
          stopListening: (event: string) => { echo.listeners.delete(event); },
        };
      },
    },
  };
});
vi.mock("@/realtime/echo", () => ({
  // `useRealtimeVersion` reads this to re-attach when the client is rebuilt.
  realtimeVersion: { current: () => 0, subscribe: () => () => {} },
  getEcho: () => echo.client,
}));

const EVENT = ".branch.visibility.changed";

beforeEach(() => {
  cache.cleared = 0;
  echo.listeners.clear();
  echo.publicChannels.length = 0;
  echo.privateChannels.length = 0;
});

afterEach(() => cleanup());

describe("BranchVisibilityGuard", () => {
  test("joins the public catalogue feed, never a private one", () => {
    render(<BranchVisibilityGuard />);

    expect(echo.publicChannels).toEqual(["branches"]);
    expect(echo.privateChannels).toEqual([]);
    expect(echo.listeners.has(EVENT)).toBe(true);
  });

  test("a visibility change re-reads every screen showing block state", () => {
    render(<BranchVisibilityGuard />);

    const before = accessVersion.current();
    echo.listeners.get(EVENT)!({ hidden: [7], visible: [] });

    expect(accessVersion.current()).toBe(before + 1);
    expect(cache.cleared).toBe(1);
  });

  test("reacts to the restore direction too, not only to blocks", () => {
    render(<BranchVisibilityGuard />);

    const before = accessVersion.current();
    echo.listeners.get(EVENT)!({ hidden: [], visible: [9] });

    expect(accessVersion.current()).toBe(before + 1);
  });

  test("stops listening when it goes away", () => {
    const view = render(<BranchVisibilityGuard />);
    view.unmount();

    expect(echo.listeners.has(EVENT)).toBe(false);
  });
});
