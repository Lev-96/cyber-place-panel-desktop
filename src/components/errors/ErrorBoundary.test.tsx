// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteErrorBoundary from "./RouteErrorBoundary";
import { tActive } from "@/i18n/translations";
import { crashReport, reloadAtHome } from "./crashReport";

// The real reload would end the test run; the rewrite itself is tested below
// on the real function, against a stand-in window.
vi.mock("./crashReport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./crashReport")>()),
  reloadAtHome: vi.fn(),
}));

/**
 * B2 (audit 2026-11-13): one render error locked the whole panel. The only
 * boundary was the root one; «Try again» re-rendered the same crash and
 * «Reload» reloaded the same URL into it, and Electron has no address bar to
 * type another. Now a screen that throws is caught INSIDE the layout: the side
 * menu stays, «Home» leaves the screen, and the details go to the clipboard
 * instead of a stack trace on the screen.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en" }),
}));
vi.mock("@/infrastructure/Logger", () => ({ logger: { error: vi.fn() } }));

const Boom = (): never => {
  const e = new Error("boom at render");
  e.stack = "Error: boom at render\n    at Boom (secret/path/Boom.tsx:1:1)";
  throw e;
};

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const Shell = ({ start }: { start: string }) => (
  <MemoryRouter initialEntries={[start]}>
    <nav>
      <Link to="/other">Other menu entry</Link>
    </nav>
    <Where />
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<div>home screen</div>} />
        <Route path="/broken" element={<Boom />} />
        <Route path="/other" element={<div>other screen</div>} />
      </Routes>
    </RouteErrorBoundary>
  </MemoryRouter>
);

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RouteErrorBoundary", () => {
  test("a crashing screen says so in place; the menu stays; no stack on screen", () => {
    render(<Shell start="/broken" />);
    expect(screen.getByText("crash.screen.title")).toBeTruthy();
    expect(screen.getByText("crash.screen.description")).toBeTruthy();
    expect(screen.getByText("Other menu entry")).toBeTruthy();
    expect(document.body.textContent).not.toContain("boom at render");
    expect(document.body.textContent).not.toContain("Boom.tsx");
  });

  test("«Home» goes to / and shows the home screen", () => {
    render(<Shell start="/broken" />);
    fireEvent.click(screen.getByText("crash.screen.home"));
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(screen.getByText("home screen")).toBeTruthy();
    expect(screen.queryByText("crash.screen.title")).toBeNull();
  });

  test("the side menu leaves the crashed screen", () => {
    render(<Shell start="/broken" />);
    fireEvent.click(screen.getByText("Other menu entry"));
    expect(screen.getByText("other screen")).toBeTruthy();
    expect(screen.queryByText("crash.screen.title")).toBeNull();
  });

  test("«Copy for support» puts the details on the clipboard", async () => {
    render(<Shell start="/broken" />);
    await act(async () => { fireEvent.click(screen.getByText("crash.screen.copy")); });
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("boom at render");
    expect(text).toContain("Boom.tsx");
    expect(screen.getByText("crash.screen.copied")).toBeTruthy();
  });
});

describe("root ErrorBoundary (last resort)", () => {
  test("«Reload» reloads onto #/, not onto the crash", () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    fireEvent.click(screen.getByText(tActive("errorBoundary.reload")));
    expect(reloadAtHome).toHaveBeenCalledTimes(1);
  });

  test("no stack trace on the root screen either; details can be copied", async () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(document.body.textContent).not.toContain("Boom.tsx");
    expect(document.body.textContent).not.toContain("boom at render");
    await act(async () => { fireEvent.click(screen.getByText(tActive("errorBoundary.copy"))); });
    expect(String(writeText.mock.calls[0][0])).toContain("Boom.tsx");
  });
});

describe("reloadAtHome", () => {
  test("rewrites the address to #/ before reloading", async () => {
    const calls: string[] = [];
    const win = {
      location: { href: "app://localhost/index.html#/branches/1/edit", reload: () => calls.push("reload") },
      history: { replaceState: (_s: unknown, _t: string, url: string) => calls.push(`replace ${url}`) },
    };
    const real = await vi.importActual<typeof import("./crashReport")>("./crashReport");
    real.reloadAtHome(win);
    expect(calls).toEqual(["replace app://localhost/index.html#/", "reload"]);
  });
});

describe("crashReport", () => {
  test("carries the message, the stacks, the route and the time", () => {
    const e = new Error("bad");
    e.stack = "Error: bad\n    at X";
    const text = crashReport({
      error: e,
      componentStack: "\n    in Screen",
      route: "#/branches/1/edit",
      at: new Date("2026-11-14T10:00:00Z"),
      version: "1.0.61",
    });
    expect(text).toContain("bad");
    expect(text).toContain("at X");
    expect(text).toContain("in Screen");
    expect(text).toContain("#/branches/1/edit");
    expect(text).toContain("2026-11-14T10:00:00.000Z");
    expect(text).toContain("1.0.61");
  });

  test("a thrown non-Error still reports", () => {
    expect(crashReport({ error: "plain", componentStack: null, route: "#/", at: new Date(0), version: null })).toContain("plain");
  });
});
