// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, test, vi } from "vitest";
import { useAsync } from "./useAsync";

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
  type Handle = { mutate: (u: (d: string | null) => string | null) => void; reload: () => Promise<void> };

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
