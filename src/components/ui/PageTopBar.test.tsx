// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PageTopBar, { barBottomInset, pageTitleIn } from "./PageTopBar";

/**
 * The bar pinned to every screen (2026-10-25): Back, and the screen's heading
 * centred once the real one has scrolled away.
 */
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));

// A controllable IntersectionObserver: the test says when the heading leaves.
const io = vi.hoisted(() => ({
  fire: null as null | ((entry: Partial<IntersectionObserverEntry>) => void),
  observed: [] as Element[],
}));

beforeEach(() => {
  io.fire = null;
  io.observed = [];
  vi.stubGlobal("IntersectionObserver", class {
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
    observe(el: Element) {
      io.observed.push(el);
      io.fire = (entry) => this.cb([{ rootBounds: { top: 36 } as DOMRectReadOnly, ...entry } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = async (path = "/branches/1/sessions", heading: string | null = "Активные места") => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <main>
          <PageTopBar />
          {heading !== null && <h2 className="page-title">{heading}</h2>}
          <div className="cp-modal"><h2 className="page-title">Dialog heading</h2></div>
        </main>
      </MemoryRouter>,
    );
  });
  // The bar looks for the heading on the next frame (and again after each
  // change it causes itself): let a few frames pass.
  for (let i = 0; i < 4; i++) {
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
  }
};

const bar = () => screen.getByTestId("page-topbar");
const title = () => screen.getByTestId("page-topbar-title");

describe("the pinned top bar", () => {
  test("Back is in it, and the heading is hidden while the real one is in view", async () => {
    await mount();
    expect(screen.getByRole("button", { name: "common.back" })).toBeTruthy();
    expect(title().textContent).toBe("Активные места");
    expect(bar().classList.contains("is-titled")).toBe(false);
    expect(title().getAttribute("aria-hidden")).toBe("true");
  });

  test("the heading scrolled away: it shows, centred in the bar", async () => {
    await mount();
    await act(async () => { io.fire?.({ isIntersecting: false, intersectionRatio: 0, boundingClientRect: { top: -40 } as DOMRectReadOnly }); });
    expect(bar().classList.contains("is-titled")).toBe(true);
    expect(title().getAttribute("aria-hidden")).toBe("false");
  });

  test("scrolled back up: it hides again", async () => {
    await mount();
    await act(async () => { io.fire?.({ isIntersecting: false, intersectionRatio: 0, boundingClientRect: { top: -40 } as DOMRectReadOnly }); });
    await act(async () => { io.fire?.({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 60 } as DOMRectReadOnly }); });
    expect(bar().classList.contains("is-titled")).toBe(false);
  });

  test("a small scroll: the heading's top under the bar already moves it into the bar", async () => {
    await mount();
    await act(async () => {
      io.fire?.({ isIntersecting: true, intersectionRatio: 0.4, boundingClientRect: { top: 20 } as DOMRectReadOnly });
    });
    expect(bar().classList.contains("is-titled")).toBe(true);
  });

  test("fully in view under the bar: not yet", async () => {
    await mount();
    await act(async () => {
      io.fire?.({ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 60 } as DOMRectReadOnly });
    });
    expect(bar().classList.contains("is-titled")).toBe(false);
  });

  test("below the fold is not 'scrolled away'", async () => {
    await mount();
    await act(async () => { io.fire?.({ isIntersecting: false, intersectionRatio: 0, boundingClientRect: { top: 2000 } as DOMRectReadOnly }); });
    expect(bar().classList.contains("is-titled")).toBe(false);
  });

  test("watches the screen's heading, never a dialog's", async () => {
    await mount();
    expect(io.observed).toHaveLength(1);
    expect(io.observed[0].textContent).toBe("Активные места");
  });

  test("a screen with no heading shows only Back", async () => {
    await mount("/settings", null);
    expect(title().textContent).toBe("");
    expect(screen.getByRole("button", { name: "common.back" })).toBeTruthy();
  });
});

describe("the home dashboard", () => {
  test("has no heading of its own, so the bar shows none — never a widget's", async () => {
    await mount("/", "Бронирования");
    expect(title().textContent).toBe("");
    expect(io.observed).toHaveLength(0);
  });
});

describe("moving between screens", () => {
  test("the last screen's heading never lingers on one without a heading", async () => {
    const Nav = () => {
      const navigate = useNavigate();
      nav.go = navigate;
      return null;
    };
    const nav = { go: (_: string) => {} };
    const Screen = () => {
      const loc = useLocation();
      return loc.pathname === "/a" ? <h2 className="page-title">Screen A</h2> : null;
    };
    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/a"]}>
          <Nav />
          <main><PageTopBar /><Screen /></main>
        </MemoryRouter>,
      );
    });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    expect(title().textContent).toBe("Screen A");

    await act(async () => { nav.go("/b"); });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    expect(title().textContent).toBe("");
    expect(bar().classList.contains("is-titled")).toBe(false);
  });
});

describe("pageTitleIn", () => {
  test("the first heading outside a dialog", () => {
    const main = document.createElement("main");
    main.innerHTML = '<div class="cp-modal"><h2 class="page-title">A</h2></div><h2 class="page-title">B</h2><h2 class="page-title">C</h2>';
    expect(pageTitleIn(main)?.textContent).toBe("B");
  });
});

describe("barBottomInset", () => {
  test("the bar ends at the scroll area's top padding plus its own height", () => {
    const main = document.createElement("main");
    main.style.paddingTop = "24px";
    const bar = document.createElement("div");
    Object.defineProperty(bar, "offsetHeight", { value: 36 });
    document.body.appendChild(main);
    expect(barBottomInset(main, bar)).toBe(60);
    main.style.paddingTop = "16px";
    expect(barBottomInset(main, bar)).toBe(52);
    main.remove();
  });
});
