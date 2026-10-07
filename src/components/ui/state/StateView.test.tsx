// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "en", t: (k: string) => t(k, "en") }) };
});

import ErrorState from "./ErrorState";
import StateSwitch from "./StateSwitch";
import StateView from "./StateView";
import { STATE_VARIANTS, StateVariant } from "./variants";
import { textLiteral } from "@/i18n/localizedText";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const VARIANTS = Object.keys(STATE_VARIANTS) as StateVariant[];

describe("StateView", () => {
  test.each(VARIANTS)("%s: its default copy, role, and a decorative player of its own pose", async (variant) => {
    await act(async () => { render(<StateView variant={variant} />); });
    const box = document.querySelector(`[data-state="${variant}"]`) as HTMLElement;
    expect(box.getAttribute("role")).toBe(variant === "error" || variant === "offline" ? "alert" : "status");
    expect(box.textContent).not.toMatch(/state\./); // translated, not a raw key

    const art = box.querySelector(".cp-state__art") as HTMLElement;
    expect(art.getAttribute("aria-hidden")).toBe("true");
    expect(art.getAttribute("data-pose")).toBe(variant);
    // The pose is lazy: it arrives as its own chunk, then draws the player.
    const svg = await vi.waitFor(() => {
      const el = art.querySelector("svg.cp-gamer");
      if (!el) throw new Error("pose not loaded");
      return el;
    });
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector(".cp-gamer__sway")).toBeTruthy();
    expect(svg.querySelector(".cp-gamer__eyes")).toBeTruthy();
  });

  test("context copy replaces the defaults, `{0}` filled, `null` drops the sentence", () => {
    render(<StateView variant="empty" titleKey="branchesList.state.emptyTitle" descriptionKey={null} />);
    expect(screen.getByText("No branches yet")).toBeTruthy();
    expect(screen.queryByText("When something is added, it appears here.")).toBeNull();
  });

  test("actions and a secondary detail render; the detail is the server's literal text", () => {
    const onClick = vi.fn();
    render(<StateView variant="error" detail={textLiteral("Database down")} actions={<button onClick={onClick}>Do it</button>} />);
    expect(screen.getByText("Database down").className).toContain("cp-state__detail");
    fireEvent.click(screen.getByRole("button", { name: "Do it" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("compact (dialogs, dropdowns): text only — no player", () => {
    render(<StateView variant="empty" size="compact" />);
    expect(document.querySelector(".cp-state--compact")).toBeTruthy();
    expect(document.querySelector(".cp-state__art")).toBeNull();
  });

  test("reduced motion stops the player (and the loaders) in CSS", () => {
    const css = readFileSync(path.resolve(__dirname, "../../../styles/global.css"), "utf8");
    const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .cp-gamer *"));
    expect(block).toMatch(/\.cp-gamer \*,\s*\.cp-skeleton\s*\{\s*animation: none;/);
    expect(block).toMatch(/\.spinner\s*\{/);
    // Motion is transform / opacity only.
    const keyframes = css.match(/@keyframes cp-gamer-[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThanOrEqual(8);
    for (const k of keyframes) {
      const props = [...k.matchAll(/\{\s*([a-z-]+):/g)].map((m) => m[1]);
      for (const p of props) expect(["transform", "opacity"]).toContain(p);
    }
  });
});

describe("ErrorState", () => {
  const apiError = (status: number, message?: string) =>
    Object.assign(new Error(message ?? `HTTP ${status}`), { status, body: message ? { message } : null });

  test("Retry calls the screen's reload", () => {
    const reload = vi.fn();
    render(<ErrorState error={apiError(500)} onRetry={reload} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("a failed read: localized title, the server's sentence only as the detail", () => {
    render(<ErrorState error={apiError(500, "SQLSTATE[HY000]")} titleKey="branchesList.state.errorTitle" />);
    expect(screen.getByText("Could not load branches")).toBeTruthy();
    expect(screen.getByText("SQLSTATE[HY000]").className).toContain("cp-state__detail");
    expect(document.querySelector('[data-state="error"]')).toBeTruthy();
  });

  test("no answer (fetch TypeError) → the offline state, never the raw «Failed to fetch»", () => {
    render(<ErrorState error={new TypeError("Failed to fetch")} onRetry={() => {}} />);
    expect(document.querySelector('[data-state="offline"]')).toBeTruthy();
    expect(screen.getByText("No connection")).toBeTruthy();
    expect(screen.queryByText("Failed to fetch")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  test("navigator.onLine === false → offline, even for a server error", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(<ErrorState error={apiError(500, "boom")} />);
    expect(document.querySelector('[data-state="offline"]')).toBeTruthy();
  });

  test("404 → not found, with the context's copy and its own action instead of Retry", () => {
    render(
      <ErrorState
        error={apiError(404, "No query results for model")}
        onRetry={() => {}}
        notFoundTitleKey="booking.state.notFoundTitle"
        notFoundAction={<button>Back to list</button>}
      />,
    );
    expect(document.querySelector('[data-state="notFound"]')).toBeTruthy();
    expect(screen.getByText("Booking not found")).toBeTruthy();
    expect(screen.queryByText("No query results for model")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to list" })).toBeTruthy();
  });

  test("never renders a stack", () => {
    const e = apiError(500);
    e.stack = "Error: at secretFunction (file.ts:1:1)";
    render(<ErrorState error={e} />);
    expect(document.body.textContent).not.toContain("secretFunction");
  });
});

describe("StateSwitch", () => {
  const base = { skeleton: <div>SKELETON</div>, children: <div>DATA</div> };

  test("one state at a time, in the view's order", () => {
    const { rerender } = render(<StateSwitch {...base} view={{ kind: "loading" }} />);
    expect(screen.getByText("SKELETON")).toBeTruthy();

    rerender(<StateSwitch {...base} view={{ kind: "empty" }} empty={{ titleKey: "tournaments.state.emptyTitle" }} />);
    expect(screen.getByText("No tournaments yet")).toBeTruthy();
    expect(screen.queryByText("DATA")).toBeNull();

    rerender(<StateSwitch {...base} view={{ kind: "noResults" }} />);
    expect(screen.getByText("Nothing found")).toBeTruthy();

    rerender(<StateSwitch {...base} view={{ kind: "ready", staleError: null }} />);
    expect(screen.getByText("DATA")).toBeTruthy();
    expect(screen.queryByText("SKELETON")).toBeNull();
  });

  test("data kept after a failed refresh: the data, plus a quiet line with Retry", () => {
    const retry = vi.fn();
    render(<StateSwitch {...base} view={{ kind: "ready", staleError: new TypeError("Failed to fetch") }} onRetry={retry} />);
    expect(screen.getByText("DATA")).toBeTruthy();
    expect(screen.getByText("No connection. This is the last loaded data.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
