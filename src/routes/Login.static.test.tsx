// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

/**
 * The sign-in screens are still (owner, 2026-11-13): "no animation at all, a
 * very beautiful background, and the page must not freeze while loading".
 *
 * Before, the screen ran a three.js space scene (≈900 KB of JavaScript and a
 * WebGL frame loop), a spinning HUD ring, a 2.3 s fly-in, a pulsing field and
 * a 3D card flip. Now the scene is ONE pre-rendered picture over a CSS
 * gradient, and nothing on the screen moves. These tests hold that shut:
 *   - no module the sign-in screens load can reach three.js;
 *   - with the real stylesheet applied, no element on the screen animates or
 *     transitions, and no `login-*` rule even declares motion;
 *   - "Forgot password?" swaps the faces at once, keeps the hidden face out of
 *     the tab order, and moves focus onto the face now showing.
 */

const auth = vi.hoisted(() => ({ login: vi.fn(async (_email: string, _password: string) => {}) }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", setLang: () => {} }),
}));
vi.mock("@/auth/recentEmails", () => ({
  recentEmails: { list: async () => [], forget: async () => {}, remember: async () => {} },
}));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

import Login from "./Login";

const SRC = path.resolve(__dirname, "..");
const CSS = readFileSync(path.join(SRC, "styles/global.css"), "utf8");

afterEach(() => {
  cleanup();
  auth.login.mockReset();
});

/* ----------------------------------------------------------- module graph -- */

/** Every module id a file imports, static or dynamic (`import("…")`). */
const importsOf = (file: string): string[] => {
  const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const ids = new Set<string>();
  for (const m of code.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm)) {
    ids.add(m[1] ?? m[2] ?? m[3]);
  }
  return [...ids];
};

/** A local id as a file, or null for a package. */
const resolveLocal = (from: string, id: string): string | null => {
  const base = id.startsWith("@/") ? path.join(SRC, id.slice(2)) : id.startsWith(".") ? path.resolve(path.dirname(from), id) : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep) && /\.(tsx?|css)$/.test(candidate)) return candidate;
  }
  throw new Error(`${from} imports ${id}, which does not resolve`);
};

/** The packages reachable from `entry` through local imports, with the path that reaches each. */
const packagesReachableFrom = (entry: string): Map<string, string[]> => {
  const found = new Map<string, string[]>();
  const seen = new Set<string>();
  const walk = (file: string, trail: string[]) => {
    if (seen.has(file) || file.endsWith(".css")) return;
    seen.add(file);
    for (const id of importsOf(file)) {
      const local = resolveLocal(file, id);
      if (local) walk(local, [...trail, path.relative(SRC, local)]);
      else if (!found.has(id)) found.set(id, trail);
    }
  };
  walk(entry, [path.relative(SRC, entry)]);
  return found;
};

describe("the sign-in screens load no 3D", () => {
  test.each(["routes/Login.tsx", "routes/ResetPassword.tsx", "components/NetworkBlockedScreen.tsx"])(
    "%s cannot reach three.js or @react-three/*, not even lazily",
    (entry) => {
      const packages = packagesReachableFrom(path.join(SRC, entry));
      const threeD = [...packages.entries()].filter(([id]) => id === "three" || id.startsWith("three/") || id.startsWith("@react-three/"));
      expect(threeD.map(([id, trail]) => `${id} via ${trail.join(" -> ")}`)).toEqual([]);
      // The walk really followed the screen's own components (not a vacuous pass).
      expect(packages.has("react")).toBe(true);
    },
  );

  test("the screen draws no canvas, scene or HUD ring", () => {
    const { container } = render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".login-scene, .login-hud, [class*='login-hud']")).toBeNull();
    expect(container.querySelector("h1.login-brand")?.textContent).toBe("Cyber Place");
  });

  // Owner, 2026-11-13: the mark on top, the wordmark under it, then the title.
  test("the mark comes first, the wordmark under it", () => {
    const { container } = render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);
    const stage = container.querySelector(".login-stage") as HTMLElement;
    expect([...stage.children].slice(0, 3).map((el) => el.className)).toEqual(["login-logo", "login-brand", "login-title"]);
  });
});

/* ------------------------------------------------------------------ motion -- */

/** Every (selector, declarations) pair in a stylesheet, @media blocks included. */
const rulesOf = (css: string): Array<{ selector: string; body: string }> => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ selector: string; body: string }> = [];
  const scan = (from: number, to: number) => {
    let start = from;
    for (let i = from; i < to; i++) {
      if (text[i] === "}") start = i + 1;
      // A statement at this level (@import, @charset) ends at its ";".
      if (text[i] === ";" && text.slice(start, i).trim().startsWith("@")) start = i + 1;
      if (text[i] !== "{") continue;
      const head = text.slice(start, i).trim();
      let depth = 1;
      let j = i + 1;
      for (; j < to && depth > 0; j++) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
      }
      const end = j - 1;
      if (head.startsWith("@media") || head.startsWith("@supports") || head.startsWith("@container") || head.startsWith("@layer")) scan(i + 1, end);
      else if (!head.startsWith("@")) out.push({ selector: head, body: text.slice(i + 1, end) });
      i = end;
      start = end + 1;
    }
  };
  scan(0, text.length);
  return out;
};

/**
 * The ONE motion the owner wants on the sign-in (2026-11-13): the card turning
 * over to «Forgot password?». Exactly these two rules may move, and only the
 * transform / the delayed visibility; anything else that moves is a failure.
 */
const FLIP_RULES: Record<string, RegExp> = {
  ".login-shell .login-flip": /^transform 760ms /,
  ".login-shell .login-flip.is-back > .login-card,\n.login-shell .login-flip:not(.is-back) > .login-flip-face-back": /^visibility 0s linear 380ms/,
};

const MOTION_KEYFRAMES = ["cpPanelApproach", "cpBrandIgnite", "cpBackdropIn", "cpFieldGlow", "cpHudSpin", "cpNodePulse", "cp-brand-in"];

describe("nothing on the sign-in screens moves", () => {
  test("no rule for a login-* element declares motion, except the card flip", () => {
    const rules = rulesOf(CSS);
    // The parser saw the sheet (not a vacuous pass).
    expect(rules.length).toBeGreaterThan(1000);
    const offenders = rules
      .filter(({ selector }) => /\.login-/.test(selector) && !(selector in FLIP_RULES))
      .flatMap(({ selector, body }) =>
        [...body.matchAll(/(?:^|;|\s)(animation|transition)(-[a-z-]+)?\s*:\s*([^;]+)/g)]
          .filter(([, , , value]) => !/^\s*none\b/.test(value))
          .map(([, prop, sub = "", value]) => `${selector} { ${prop}${sub}: ${value.trim()} }`),
      );
    expect(offenders).toEqual([]);
  });

  test("the card flip is there, and still under reduced motion", () => {
    const rules = rulesOf(CSS);
    for (const [selector, value] of Object.entries(FLIP_RULES)) {
      const rule = rules.find((r) => r.selector === selector && /transition/.test(r.body) && !/none/.test(r.body));
      expect(rule, selector).toBeDefined();
      expect(rule!.body.match(/transition\s*:\s*([^;]+)/)![1].trim()).toMatch(value);
    }
    expect(rules.some((r) => r.selector === ".login-flip.is-back" && /rotateY\(180deg\)/.test(r.body))).toBe(true);
    expect(rules.some((r) => r.selector === ".login-flip-face-back" && /rotateY\(180deg\)/.test(r.body))).toBe(true);
    // Reduced motion: an instant swap.
    const reduced = CSS.replace(/\/\*[\s\S]*?\*\//g, "").match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.login-shell \.login-flip,\s*\.login-shell \.login-flip\.is-back > \.login-card,\s*\.login-shell \.login-flip:not\(\.is-back\) > \.login-flip-face-back\s*\{\s*transition:\s*none !important;/);
    expect(reduced).not.toBeNull();
  });

  test("the old entrance, ignition, glow, ring and pulse keyframes are gone", () => {
    for (const name of MOTION_KEYFRAMES) expect(CSS).not.toMatch(new RegExp(`@keyframes\\s+${name}\\b`));
  });

  test("the wordmark's shared neon keyframes stay for the side menu", () => {
    expect(CSS).toMatch(/@keyframes brandFlicker\b/);
    expect(CSS).toMatch(/@keyframes brandGlow\b/);
    expect(rulesOf(CSS).some(({ selector, body }) => selector === ".sidebar h1 span" && /brandGlow/.test(body))).toBe(true);
  });

  describe("with the real stylesheet applied", () => {
    beforeAll(() => {
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.appendChild(style);
    });

    const still = (root: Element) => {
      const moving: string[] = [];
      for (const el of [root, ...root.querySelectorAll("*")]) {
        const cs = getComputedStyle(el);
        const animation = cs.getPropertyValue("animation").trim();
        const transition = cs.getPropertyValue("transition").trim();
        if (animation && !animation.startsWith("none")) moving.push(`${el.className || el.tagName}: animation ${animation}`);
        const flip =
          (el.matches(".login-shell .login-flip") && /^transform 760ms /.test(transition)) ||
          (el.matches(".login-shell .login-flip.is-back > .login-card, .login-shell .login-flip:not(.is-back) > .login-flip-face-back") &&
            /^visibility 0s linear 380ms/.test(transition));
        if (transition && !flip && !/^(none|all 0s)/.test(transition)) moving.push(`${el.className || el.tagName}: transition ${transition}`);
      }
      return moving;
    };

    test.each(["/login", "/forgot-password"])("no element on %s animates or transitions except the card flip", (at) => {
      render(<MemoryRouter initialEntries={[at]}><Login /></MemoryRouter>);
      const shell = document.querySelector(".login-shell")!;
      // Shared controls the screen uses (inputs, buttons, the eye, pills) are in it.
      expect(shell.querySelectorAll(".input").length).toBeGreaterThanOrEqual(3);
      expect(shell.querySelector(".btn")).not.toBeNull();
      expect(shell.querySelector(".pw-eye")).not.toBeNull();
      expect(still(shell)).toEqual([]);
    });

    test("the forgot face turns in: the hidden face is not drawn and not reachable, focus moves with it", async () => {
      render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);
      const front = document.querySelector(".login-flip > form.login-card") as HTMLFormElement;
      const back = document.querySelector(".login-flip-face-back") as HTMLElement;
      const frontEmail = front.querySelector("input[type='email']") as HTMLInputElement;
      const backEmail = back.querySelector("input[type='email']") as HTMLInputElement;

      expect(getComputedStyle(front).visibility).toBe("visible");
      expect(getComputedStyle(back).visibility).toBe("hidden");
      expect(back.hasAttribute("inert")).toBe(true);
      expect(front.hasAttribute("inert")).toBe(false);

      await act(async () => { fireEvent.click(screen.getByText("auth.forgot")); });

      expect(document.querySelector(".login-flip")!.classList.contains("is-back")).toBe(true);
      expect(getComputedStyle(front).visibility).toBe("hidden");
      expect(getComputedStyle(back).visibility).toBe("visible");
      expect(front.hasAttribute("inert")).toBe(true);
      expect(back.hasAttribute("inert")).toBe(false);
      // The card turns over to the forgot face.
      expect(getComputedStyle(document.querySelector(".login-flip")!).transform).toBe("rotateY(180deg)");
      expect(document.activeElement).toBe(backEmail);

      await act(async () => { fireEvent.click(screen.getByText("auth.backToLogin")); });

      expect(document.querySelector(".login-flip")!.classList.contains("is-back")).toBe(false);
      expect(getComputedStyle(front).visibility).toBe("visible");
      expect(getComputedStyle(back).visibility).toBe("hidden");
      expect(back.hasAttribute("inert")).toBe(true);
      expect(document.activeElement).toBe(frontEmail);
    });

    test("a deep link to /forgot-password opens on the forgot face with its field focused", () => {
      render(<MemoryRouter initialEntries={["/forgot-password"]}><Login /></MemoryRouter>);
      const back = document.querySelector(".login-flip-face-back") as HTMLElement;
      expect(getComputedStyle(back).visibility).toBe("visible");
      expect(document.activeElement).toBe(back.querySelector("input[type='email']"));
    });
  });
});

/* -------------------------------------------------------------- background -- */

describe("the still background", () => {
  const body = (selector: string) => rulesOf(CSS).filter((r) => r.selector === selector).map((r) => r.body).join("\n");

  test("is the pre-rendered scene over a gradient that paints at once", () => {
    const all = body(".login-shell");
    expect(all).toMatch(/url\("\/bg\/login-space\.webp"\)/);
    expect(all).toMatch(/radial-gradient\(/);
    expect(existsSync(path.resolve(SRC, "../public/bg/login-space.webp"))).toBe(true);
    expect(existsSync(path.resolve(SRC, "../public/bg/login-space-portrait.webp"))).toBe(true);
  });

  test("a tall screen gets the portrait picture", () => {
    expect(CSS).toMatch(/@media \(max-aspect-ratio: 3\/4\) \{[^}]*\.login-shell \{[^}]*login-space-portrait\.webp/);
  });

  test("the pictures stay small enough not to hold the screen up", () => {
    for (const name of ["login-space.webp", "login-space-portrait.webp"]) {
      const size = readFileSync(path.resolve(SRC, "../public/bg", name)).length;
      expect(size).toBeLessThanOrEqual(250 * 1024);
    }
  });
});
