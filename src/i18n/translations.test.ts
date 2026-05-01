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
