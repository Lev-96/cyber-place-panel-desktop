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

/**
 * The Armenian copy (2026-09-28 audit): the defects it fixed must not come
 * back. Terms follow the official site (cyberplace.pro, hy).
 */
describe("Armenian copy", () => {
  const entries = Object.entries(TRANSLATIONS);
  const placeholders = (s: string) => (s.match(/\{[^}]+\}/g) ?? []).sort().join(",");
  /** A standalone word (Armenian has no \b in JS regex). */
  const word = (w: string) => new RegExp(`(^|[^\\u0530-\\u058F])${w}`, "iu");

  it("carries every placeholder the English does", () => {
    for (const [key, dict] of entries) {
      expect(placeholders(dict.am), key).toBe(placeholders(dict.en));
    }
  });

  it("has no Cyrillic or Latin letter glued inside an Armenian word", () => {
    for (const [key, dict] of entries) {
      expect(/[А-Яа-яЁё]/.test(dict.am), `${key}: ${dict.am}`).toBe(false);
      // Latin next to an Armenian LETTER (U+0531–0556, U+0561–0587); Armenian
      // punctuation such as «՝» after "PIN" is fine.
      expect(/[\u0531-\u0556\u0561-\u0587][A-Za-z]|[A-Za-z][\u0531-\u0556\u0561-\u0587]/.test(dict.am), `${key}: ${dict.am}`).toBe(false);
    }
  });

  it("calls a session «սեսիա», never «նիստ» or «սեանս»", () => {
    for (const [key, dict] of entries) {
      expect(word("նիստ").test(dict.am) || word("սեանս").test(dict.am), `${key}: ${dict.am}`).toBe(false);
    }
  });

  it("names the kiosk program «Agent», not «գործակալ»", () => {
    for (const [key, dict] of entries) {
      expect(word("գործակալ").test(dict.am), `${key}: ${dict.am}`).toBe(false);
    }
  });

  it("uses «ՀՀ» only for the Republic of Armenia (the tax number), never for a computer", () => {
    const withHH = entries.filter(([, dict]) => /ՀՀ(?!Հ)/.test(dict.am.replace(/ՀՎՀՀ/g, ""))).map(([key]) => key);
    expect(withHH).toEqual([]);
  });

  it("ends Armenian sentences with «։», not a Latin full stop", () => {
    for (const [key, dict] of entries) {
      // A sentence (it has a space); a lone abbreviation like «տեղադր.» keeps its dot.
      const sentence = dict.am.trim().includes(" ");
      expect(sentence && /[\u0531-\u0556\u0561-\u0587]\.\s*$/.test(dict.am), `${key}: ${dict.am}`).toBe(false);
    }
  });
});
