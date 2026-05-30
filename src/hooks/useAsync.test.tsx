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
