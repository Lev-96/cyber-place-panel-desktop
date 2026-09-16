import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fmt, LANGUAGES, TRANSLATIONS, t } from "./translations";

describe("fmt", () => {
  it("substitutes positional placeholders", () => {
    expect(fmt("Hello, {0}!", "world")).toBe("Hello, world!");
    expect(fmt("{0} + {1} = {2}", 1, 2, 3)).toBe("1 + 2 = 3");
  });

  it("leaves placeholders untouched when out of range", () => {
    expect(fmt("only {0} provided, {1} missing", "first")).toBe(
      "only first provided, {1} missing",
    );
  });

  it("returns the template unchanged when no placeholders present", () => {
    expect(fmt("plain text")).toBe("plain text");
  });

  it("repeats a placeholder when used multiple times", () => {
    expect(fmt("{0} and {0}", "x")).toBe("x and x");
  });
});

describe("translations dictionary", () => {
  it("declares en/ru/am for every key", () => {
    for (const [key, dict] of Object.entries(TRANSLATIONS)) {
      expect(dict, `key '${key}' should expose 'en'`).toHaveProperty("en");
      expect(dict, `key '${key}' should expose 'ru'`).toHaveProperty("ru");
      expect(dict, `key '${key}' should expose 'am'`).toHaveProperty("am");
      expect(typeof dict.en, `'${key}'.en should be a string`).toBe("string");
      expect(typeof dict.ru, `'${key}'.ru should be a string`).toBe("string");
      expect(typeof dict.am, `'${key}'.am should be a string`).toBe("string");
    }
  });

  it("never lets a translation be empty", () => {
    for (const [key, dict] of Object.entries(TRANSLATIONS)) {
      for (const lang of ["en", "ru", "am"] as const) {
        expect(
          dict[lang].length,
          `'${key}'.${lang} must not be empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Every literal `t("…")` in the app resolves to a key that exists.
   *
   * The cases above check the shape of the keys that ARE here; none of them
   * could see a key the code asks for and the dictionary does not have. `t()`
   * falls back to returning the key itself — a caller-friendly default that is
   * also how "joystickPrice.saved" reached a venue's screen as the text of a
   * success toast, after the form that owned that key was deleted and a new
   * one kept calling it.
   *
   * Literal calls only. A key built from a template is checked by the test of
   * the screen that builds it, and guessing at its shape here would be a
   * second, worse implementation of the same question.
   */
  it("resolves every literal t() key used in the app", () => {
    const root = path.resolve(__dirname, "..");
    const dictionary = path.join(root, "i18n", "translations.ts");
    const used = new Map<string, string>();
    // `t("some.key")`, but not `import("…")`, `split("…")` or anything else
    // whose name happens to end in t.
    const call = /(?<![A-Za-z0-9_$.])t\(\s*"([^"]+)"\s*\)/g;

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (! /\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue;
        if (full === dictionary) continue;

        const source = fs.readFileSync(full, "utf8");
        for (const match of source.matchAll(call)) {
          if (! used.has(match[1])) used.set(match[1], path.relative(root, full));
        }
      }
    };
    walk(root);

    const missing = [...used.entries()].filter(([key]) => !(key in TRANSLATIONS));

    expect(
      missing.map(([key, file]) => `${key} (${file})`),
      "these keys are asked for in code and are not in the dictionary, so the screen shows the key itself",
    ).toEqual([]);
    // …and the scan itself has to be finding something, or it passes by
    // looking at nothing.
    expect(used.size).toBeGreaterThan(200);
  });

  it("LANGUAGES list matches the dictionary lang codes", () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(["am", "en", "ru"]);
  });
});

describe("t() resolver", () => {
  it("returns the translation for a known key", () => {
    expect(t("login.title", "en")).toBe("Sign in");
    expect(t("login.title", "ru")).toBe("Вход");
    expect(t("login.title", "am")).toBe("Մուտք");
  });

  it("returns the key itself for an unknown key — caller-friendly fallback", () => {
    expect(t("does.not.exist", "en")).toBe("does.not.exist");
  });
});
