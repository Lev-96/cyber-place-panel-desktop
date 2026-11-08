import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { THEMES } from "./uiPreferences";

/**
 * Every colour theme (2026-11-04, owner: 5–7 themes, easy on the eyes in a
 * club with the lights down) has its token block and its swatch in the
 * stylesheet, and keeps text readable: computed from the stylesheet itself,
 * so a token edited later cannot quietly drop a theme under 4.5:1.
 */
const css = fs.readFileSync(path.resolve(__dirname, "../styles/global.css"), "utf8");

const blockOf = (selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return "";
  return css.slice(at, css.indexOf("}", at));
};
const tokenIn = (block: string, name: string): string | null => {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  return m ? m[1] : null;
};
const ROOT = blockOf(":root");
const CALM = ["light", "purple", "midnight", "emerald", "amber"];
const CALM_BLOCK = blockOf(`:is(${CALM.map((t) => `[data-theme="${t}"]`).join(", ")})`);
/**
 * A theme's colour as the browser resolves it: the shared calm-status block
 * (it comes after the themes), else the theme's own block, else the dark
 * theme's (`:root`).
 */
const colour = (theme: string, name: string): string => {
  const shared = CALM.includes(theme) ? tokenIn(CALM_BLOCK, name) : null;
  const own = theme === "dark" ? null : tokenIn(blockOf(`[data-theme="${theme}"]`), name);
  const value = shared ?? own ?? tokenIn(ROOT, name);
  if (!value) throw new Error(`${name} has no hex value for ${theme}`);
  return value;
};
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("colour themes", () => {
  test("there are 7, the dark one first (the default)", () => {
    expect(THEMES).toEqual(["dark", "light", "contrast", "purple", "midnight", "emerald", "amber"]);
  });

  test.each(THEMES.filter((t) => t !== "dark"))("%s has its own token block", (theme) => {
    expect(blockOf(`[data-theme="${theme}"]`)).toContain("--color-surface:");
  });

  test.each([...THEMES])("%s has its swatch for the theme picker", (theme) => {
    expect(css).toMatch(new RegExp(`\\.theme-swatch--${theme} \\{ background:`));
  });

  test.each([...THEMES])("%s keeps text, muted text and the accent readable (≥ 4.5:1)", (theme) => {
    for (const surface of ["--color-surface", "--color-bg"]) {
      const s = colour(theme, surface);
      expect(contrast(colour(theme, "--color-text"), s), `text on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour(theme, "--color-muted"), s), `muted on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour(theme, "--color-primary"), s), `primary on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour(theme, "--color-danger"), s), `danger on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(colour(theme, "--color-on-primary"), colour(theme, "--color-primary")), "a primary button's text")
      .toBeGreaterThanOrEqual(4.5);
  });

  // No white theme at all (2026-11-05, owner: it hurt the eyes): every
  // theme's page and surfaces are dark — «Серая» (id `light`) included.
  test.each([...THEMES])("%s has no light page or surface", (theme) => {
    for (const name of ["--color-bg", "--color-surface", "--color-surface-alt"]) {
      expect(luminance(colour(theme, name)), name).toBeLessThan(0.05);
    }
  });

  test("text is never pure white in the calm themes (less glare)", () => {
    for (const theme of ["light", "purple", "midnight", "emerald", "amber"]) {
      expect(colour(theme, "--color-text").toLowerCase(), theme).not.toBe("#ffffff");
    }
  });

  test("the calm themes share softer status colours (one block, after the themes)", () => {
    const shared = css.indexOf(':is([data-theme="light"], [data-theme="purple"], [data-theme="midnight"], [data-theme="emerald"], [data-theme="amber"]) {');
    expect(shared).toBeGreaterThan(css.indexOf('[data-theme="amber"] {'));
    expect(css.slice(shared, css.indexOf("}", shared))).toContain("--status-playing-rgb:");
  });
});
