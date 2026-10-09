// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, test, vi } from "vitest";
import { apiCache } from "@/api/client";
import { useAsync, UseAsyncOptions } from "./useAsync";

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const Probe = ({ fn, onState }: { fn: () => Promise<unknown>; onState: (s: { loading: boolean; data: unknown; error: Error | null }) => void }) => {
  const { data, loading, error } = useAsync(fn, []);
  onState({ loading, data, error });
  return null;
};

describe("useAsync — StrictMode lifecycle", () => {
  test("commits data after mount→cleanup→mount (StrictMode double-mount)", async () => {
    let resolveFetch: (value: string) => void = () => {};
    const fetchPromise = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });
    const fn = vi.fn().mockReturnValue(fetchPromise);
    const states: Array<{ loading: boolean; data: unknown; error: Error | null }> = [];

    await act(async () => {
      render(
        <StrictMode>
          <Probe fn={fn} onState={(s) => states.push(s)} />
        </StrictMode>,
      );
    });

    expect(states.at(-1)?.loading).toBe(true);

    await act(async () => {
      resolveFetch("payload");
      await flushMicrotasks();
    });

    const final = states.at(-1);
    expect(final?.loading).toBe(false);
    expect(final?.data).toBe("payload");
    expect(final?.error).toBeNull();
  });
});

/**
 * `mutate` puts the answer a WRITE already returned on screen, without waiting
 * for a second round trip to read it back.
 *
 * And a read that was already in flight when the write answered started
 * before the write landed, so what it carries is older than what `mutate`
 * just applied — it must not paint over it. The next `reload()` is what
 * reconciles, and it is always asked for right after.
 */
describe("useAsync — mutate", () => {
  type Handle = { mutate: (u: (d: string | null) => string | null) => void; reload: () => Promise<boolean> };

  const MutProbe = ({ fn, onState, onHandle }: {
    fn: () => Promise<string>;
    onState: (d: string | null) => void;
    onHandle: (h: Handle) => void;
  }) => {
    const { data, mutate, reload } = useAsync(fn, []);
    onState(data);
    onHandle({ mutate, reload });
    return null;
  };

  test("applies at once", async () => {
    const states: Array<string | null> = [];
    let handle: Handle | null = null;

    await act(async () => {
      render(<MutProbe fn={() => Promise.resolve("server")} onState={(d) => states.push(d)} onHandle={(h) => { handle = h; }} />);
      await flushMicrotasks();
    });
    expect(states.at(-1)).toBe("server");

    act(() => { handle!.mutate(() => "written"); });

    expect(states.at(-1)).toBe("written");
  });

  test("a read already in flight does not paint over it", async () => {
    const states: Array<string | null> = [];
    let handle: Handle | null = null;
    let calls = 0;
    let resolveSlow: (v: string) => void = () => {};
    const fn = () => {
      calls += 1;
      if (calls === 1) return Promise.resolve("first");
      return new Promise<string>((resolve) => { resolveSlow = resolve; });
    };

    await act(async () => {
      render(<MutProbe fn={fn} onState={(d) => states.push(d)} onHandle={(h) => { handle = h; }} />);
      await flushMicrotasks();
    });

    // A poll starts, the write answers and is applied, THEN the poll lands.
    act(() => { void handle!.reload(); });
    act(() => { handle!.mutate(() => "written"); });
    await act(async () => { resolveSlow("stale"); await flushMicrotasks(); });

    expect(states.at(-1)).toBe("written");
  });
});

/**
 * A changed cached body re-runs every mounted read (guarantee 3) — except one
 * that opted out because reading has a side effect on the server (the IP
 * activity details are audited per read, 2026-10-07).
 */
describe("useAsync — cache revalidation", () => {
  const RevProbe = ({ fn, options }: { fn: () => Promise<string>; options?: UseAsyncOptions }) => {
    useAsync(fn, [], options);
    return null;
  };
  const announce = () => apiCache.replace(`GET /probe-${Math.random()}`, "{}", null);

  test("re-runs by default when the cache announces a change", async () => {
    const fn = vi.fn(() => Promise.resolve("x"));
    await act(async () => { render(<RevProbe fn={fn} />); await flushMicrotasks(); });
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { announce(); await flushMicrotasks(); });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("does not re-run with revalidateOnCacheChange: false", async () => {
    const fn = vi.fn(() => Promise.resolve("x"));
    await act(async () => { render(<RevProbe fn={fn} options={{ revalidateOnCacheChange: false }} />); await flushMicrotasks(); });
    await act(async () => { announce(); await flushMicrotasks(); });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/**
 * `reload()` tells its caller how it ended (2026-10-09): the Security screen's
 * Refresh button toasts success only when every list it asked for answered.
 * It never rejects, and the data already on screen survives a failure.
 */
describe("useAsync — reload() result", () => {
  type Handle = { reload: () => Promise<boolean>; mutate: (u: (d: string | null) => string | null) => void };
  type Seen = { data: string | null; error: Error | null };

  const ResultProbe = ({ fn, onState, onHandle }: {
    fn: () => Promise<string>;
    onState: (s: Seen) => void;
    onHandle: (h: Handle) => void;
  }) => {
    const { data, error, reload, mutate } = useAsync(fn, []);
    onState({ data, error });
    onHandle({ reload, mutate });
    return null;
  };

  const mountWith = async (fn: () => Promise<string>) => {
    const states: Seen[] = [];
    let handle: Handle | null = null;
    const view = await act(async () => {
      const r = render(<ResultProbe fn={fn} onState={(s) => states.push(s)} onHandle={(h) => { handle = h; }} />);
      await flushMicrotasks();
      return r;
    });
    return { states, handle: () => handle!, view };
  };

  test("resolves true when the run succeeded and is current", async () => {
    const { handle, states } = await mountWith(() => Promise.resolve("ok"));
    let result: boolean | null = null;
    await act(async () => { result = await handle().reload(); });
    expect(result).toBe(true);
    expect(states.at(-1)).toEqual({ data: "ok", error: null });
  });

  test("resolves false on failure, never rejects, and keeps the data", async () => {
    let calls = 0;
    const { handle, states } = await mountWith(() => {
      calls += 1;
      return calls === 1 ? Promise.resolve("first") : Promise.reject(new Error("down"));
    });
    let result: boolean | null = null;
    await act(async () => { result = await handle().reload(); });
    expect(result).toBe(false);
    expect(states.at(-1)?.data).toBe("first");
    expect(states.at(-1)?.error?.message).toBe("down");
  });

  test("resolves false when a newer run superseded it", async () => {
    let calls = 0;
    const resolvers: Array<(v: string) => void> = [];
    const { handle } = await mountWith(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve("first");
      return new Promise<string>((resolve) => { resolvers.push(resolve); });
    });
    let older: Promise<boolean> = Promise.resolve(true);
    let newer: Promise<boolean> = Promise.resolve(false);
    act(() => { older = handle().reload(); });
    act(() => { newer = handle().reload(); });
    await act(async () => { resolvers[0]("old"); resolvers[1]("new"); await flushMicrotasks(); });
    expect(await older).toBe(false);
    expect(await newer).toBe(true);
  });

  test("resolves false when mutate() superseded it", async () => {
    let calls = 0;
    let resolveSlow: (v: string) => void = () => {};
    const { handle } = await mountWith(() => {
      calls += 1;
      return calls === 1 ? Promise.resolve("first") : new Promise<string>((resolve) => { resolveSlow = resolve; });
    });
    let pending: Promise<boolean> = Promise.resolve(true);
    act(() => { pending = handle().reload(); });
    act(() => { handle().mutate(() => "written"); });
    await act(async () => { resolveSlow("stale"); await flushMicrotasks(); });
    expect(await pending).toBe(false);
  });

  test("resolves false when the component unmounted first", async () => {
    let calls = 0;
    let resolveSlow: (v: string) => void = () => {};
    const { handle, view } = await mountWith(() => {
      calls += 1;
      return calls === 1 ? Promise.resolve("first") : new Promise<string>((resolve) => { resolveSlow = resolve; });
    });
    let pending: Promise<boolean> = Promise.resolve(true);
    act(() => { pending = handle().reload(); });
    view.unmount();
    resolveSlow("late");
    expect(await pending).toBe(false);
  });
});
