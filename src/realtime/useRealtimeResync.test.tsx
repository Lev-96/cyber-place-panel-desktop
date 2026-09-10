// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useRealtimeResync } from "./useRealtimeResync";

/**
 * The reconciliation half of the realtime contract: Reverb does not replay, so
 * a client that only resumes listening after a drop keeps whatever it had
 * before the gap. Everything here is about telling a reconnect apart from a
 * first connect — re-reading on the first one races the screen's own mount
 * fetch, and not re-reading on the second is the bug.
 */

const conn = vi.hoisted(() => ({
  handlers: new Map<string, Set<() => void>>(),
  state: "connecting" as string,
  // How many times `bind` was CALLED, not how many handlers are currently
  // attached. The two differ exactly where it matters: an effect that re-runs
  // unbinds and rebinds, leaving the attached count at one while having
  // rebuilt the subscription — which is the thing being asserted against.
  binds: 0,
  bind(event: string, handler: () => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    this.binds += 1;
  },
  unbind(event: string, handler: () => void) {
    this.handlers.get(event)?.delete(handler);
  },
  fire(event: string) {
    for (const h of [...(this.handlers.get(event) ?? [])]) h();
  },
  bound(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  },
  reset() {
    this.handlers.clear();
    this.state = "connecting";
    this.binds = 0;
  },
}));

vi.mock("./echo", () => ({
  peekEcho: () => ({ connector: { pusher: { connection: conn } } }),
}));
vi.mock("./useRealtimeVersion", () => ({ useRealtimeVersion: () => 0 }));

const Probe = ({ onReconnect }: { onReconnect: () => void }) => {
  useRealtimeResync(onReconnect);
  return null;
};

const mount = (onReconnect: () => void) =>
  render(<Probe onReconnect={onReconnect} />);

describe("re-reading after the socket comes back", () => {
  beforeEach(() => conn.reset());
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("the first connect does not re-read — the mount fetch is already in flight", () => {
    const resync = vi.fn();
    mount(resync);

    act(() => conn.fire("connected"));

    expect(resync).not.toHaveBeenCalled();
  });

  test("a connect AFTER a drop re-reads", () => {
    const resync = vi.fn();
    mount(resync);

    act(() => conn.fire("connected")); // first
    act(() => conn.fire("disconnected"));
    act(() => conn.fire("connected")); // back

    expect(resync).toHaveBeenCalledTimes(1);
  });

  test("a socket that dropped before it ever connected still counts the next connect as a return", () => {
    const resync = vi.fn();
    mount(resync);

    // No `connected` at all first — the app started offline.
    act(() => conn.fire("unavailable"));
    act(() => conn.fire("connected"));

    expect(resync).toHaveBeenCalledTimes(1);
  });

  test("mounting onto an already-connected socket treats the next connect as a return", () => {
    conn.state = "connected";
    const resync = vi.fn();
    mount(resync);

    act(() => conn.fire("connected"));

    expect(resync).toHaveBeenCalledTimes(1);
  });

  test("re-rendering with a new callback does not rebind the connection", () => {
    const resync = vi.fn();
    const view = render(<Probe onReconnect={resync} />);

    const bindsAfterMount = conn.binds;
    view.rerender(<Probe onReconnect={() => resync()} />);
    view.rerender(<Probe onReconnect={() => resync()} />);

    // Counting attached handlers would NOT catch this: a re-run unbinds before
    // it binds, so the attached count is one either way and the assertion
    // would pass with the ref removed. It has to be the number of binds.
    expect(conn.binds).toBe(bindsAfterMount);
    expect(conn.bound("connected")).toBe(1);
  });

  test("the newest callback is the one a reconnect calls", () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Probe onReconnect={first} />);

    act(() => conn.fire("connected"));
    view.rerender(<Probe onReconnect={second} />);
    act(() => conn.fire("disconnected"));
    act(() => conn.fire("connected"));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("unmounting releases every handler", () => {
    const view = mount(vi.fn());
    view.unmount();

    expect(conn.bound("connected")).toBe(0);
    expect(conn.bound("disconnected")).toBe(0);
    expect(conn.bound("unavailable")).toBe(0);
  });
});
