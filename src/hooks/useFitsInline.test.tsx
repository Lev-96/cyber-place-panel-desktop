// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useFitsInline } from "./useFitsInline";

/**
 * jsdom has no layout and no ResizeObserver: the observer is faked (callbacks
 * fired by hand) and the two widths are stubbed per element, so the hook's
 * decision — and how often it re-renders — is what is pinned.
 */
class FakeRO {
  static instances: FakeRO[] = [];
  observed: Element[] = [];
  constructor(private cb: ResizeObserverCallback) { FakeRO.instances.push(this); }
  observe(el: Element) { this.observed.push(el); }
  unobserve() {}
  disconnect() { this.observed = []; }
  fire() { this.cb([], this as unknown as ResizeObserver); }
}

const widths = { container: 400, measure: 300 };
let renders = 0;

const Harness = ({ dep = 0 }: { dep?: number }) => {
  const { containerRef, measureRef, fits } = useFitsInline([dep]);
  renders += 1;
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) Object.defineProperty(el, "clientWidth", { configurable: true, get: () => widths.container });
      }}
    >
      <div
        ref={(el) => {
          measureRef.current = el;
          if (el) Object.defineProperty(el, "scrollWidth", { configurable: true, get: () => widths.measure });
        }}
      />
      <span data-testid="mode">{fits ? "row" : "compact"}</span>
    </div>
  );
};

const mode = () => document.querySelector("[data-testid=mode]")!.textContent;
const tick = async () => { await act(async () => { FakeRO.instances.forEach((r) => r.fire()); }); };

beforeEach(() => {
  FakeRO.instances = [];
  widths.container = 400;
  widths.measure = 300;
  renders = 0;
  vi.stubGlobal("ResizeObserver", FakeRO);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useFitsInline", () => {
  test("observes both the container and the measure row", () => {
    render(<Harness />);
    expect(FakeRO.instances).toHaveLength(1);
    expect(FakeRO.instances[0].observed).toHaveLength(2);
  });

  test("flips to compact when the row outgrows the container, and back", async () => {
    render(<Harness />);
    expect(mode()).toBe("row");

    widths.container = 200;
    await tick();
    expect(mode()).toBe("compact");

    widths.container = 500;
    await tick();
    expect(mode()).toBe("row");
  });

  test("a longer label (measure row grows) flips it too", async () => {
    render(<Harness />);
    widths.measure = 450;
    await tick();
    expect(mode()).toBe("compact");
  });

  test("decides before paint on mount when it does not fit", () => {
    widths.container = 100;
    render(<Harness />);
    expect(mode()).toBe("compact");
  });

  test("re-measures when deps change (language / options), without a resize", async () => {
    const { rerender } = render(<Harness dep={1} />);
    widths.measure = 999;
    await act(async () => { rerender(<Harness dep={2} />); });
    expect(mode()).toBe("compact");
  });

  test("resizes that keep the answer cost no render; renders stay bounded", async () => {
    render(<Harness />);
    const base = renders;
    for (let i = 0; i < 20; i += 1) {
      widths.container = 350 + i;
      await tick();
    }
    expect(renders).toBe(base);

    widths.container = 100;
    await tick();
    await tick();
    expect(renders).toBe(base + 1);
  });

  test("zero width (not laid out) counts as fitting", async () => {
    widths.container = 0;
    render(<Harness />);
    await tick();
    expect(mode()).toBe("row");
  });

  test("without ResizeObserver it is always the row", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("ResizeObserver", undefined);
    widths.container = 10;
    render(<Harness />);
    expect(mode()).toBe("row");
  });
});
