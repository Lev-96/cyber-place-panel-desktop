// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAppUpdates } from "./useAppUpdates";

/**
 * Four components mount this hook at once — `App.tsx`,
 * `UpdatesNotificationContext`, and the two update routes — and Echo caches a
 * channel object without refcounting. So the teardown of ONE of them decides
 * whether the other three still hear anything.
 *
 * It used to call `stopListening(event)` with no listener and then
 * `leaveChannel`, either of which is enough: opening `/settings/updates` and
 * navigating away left the root-level updater subscription dead for the rest
 * of the process, silently, with no way to notice short of a release going out
 * and nobody being told.
 */

const channel = vi.hoisted(() => ({
  listeners: new Map<string, Set<(e: unknown) => void>>(),
  listen(event: string, handler: (e: unknown) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return this;
  },
  stopListening(event: string, handler?: (e: unknown) => void) {
    if (handler) this.listeners.get(event)?.delete(handler);
    else this.listeners.delete(event);
    return this;
  },
  count(event: string) {
    return this.listeners.get(event)?.size ?? 0;
  },
  reset() {
    this.listeners.clear();
  },
}));

const echo = vi.hoisted(() => ({
  left: [] as string[],
  channel: () => channel,
  leaveChannel(name: string) {
    this.left.push(name);
    channel.reset();
  },
}));

vi.mock("./echo", () => ({ getEcho: () => echo }));
vi.mock("./useRealtimeVersion", () => ({ useRealtimeVersion: () => 0 }));

const Probe = ({ onEvent }: { onEvent?: (e: unknown) => void }) => {
  useAppUpdates("panel", onEvent as never);
  return null;
};

describe("several screens sharing the app-updates channel", () => {
  beforeEach(() => {
    channel.reset();
    echo.left = [];
    (window as unknown as { cyberplaceUpdates?: unknown }).cyberplaceUpdates = {
      checkGated: () => Promise.resolve(),
    };
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("unmounting one screen leaves the others still listening", () => {
    const root = render(<Probe onEvent={vi.fn()} />);
    const route = render(<Probe onEvent={vi.fn()} />);

    expect(channel.count(".app-update.promoted")).toBe(2);

    route.unmount();

    expect(
      channel.count(".app-update.promoted"),
      "the leaving screen took its siblings' listeners with it — the root-level " +
        "updater subscription is now dead for the rest of the process",
    ).toBe(1);
  });

  test("…and never leaves the shared channel", () => {
    const route = render(<Probe onEvent={vi.fn()} />);
    route.unmount();

    expect(echo.left).toEqual([]);
  });

  test("the surviving screen still receives events", () => {
    const stillMounted = vi.fn();
    render(<Probe onEvent={stillMounted} />);
    const route = render(<Probe onEvent={vi.fn()} />);

    route.unmount();

    for (const h of channel.listeners.get(".app-update.promoted") ?? []) {
      h({ app: "agent", version: "1.0.0" });
    }

    expect(stillMounted).toHaveBeenCalledTimes(1);
  });
});
