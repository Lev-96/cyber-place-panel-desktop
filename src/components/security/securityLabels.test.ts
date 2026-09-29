import { describe, expect, test } from "vitest";
import { TRANSLATIONS } from "@/i18n/translations";
import { AUDIT_ACTION_LABEL_KEY, CLIENT_LABEL_KEY, ROLE_LABEL_KEY, STATUS_LOOK } from "./securityLabels";

/**
 * Keys reached through a lookup table are not literal `t()` calls, so the
 * dictionary's own scan cannot see them. Every one must exist in en/ru/am, or
 * the screen prints the key.
 */
describe("Security label tables", () => {
  const keys = [
    ...Object.values(CLIENT_LABEL_KEY),
    ...Object.values(ROLE_LABEL_KEY),
    ...Object.values(STATUS_LOOK).map((l) => l.key),
    ...Object.values(AUDIT_ACTION_LABEL_KEY),
  ];

  test.each(keys)("%s is translated in every language", (key) => {
    const entry = TRANSLATIONS[key];
    expect(entry, key).toBeDefined();
    expect(entry.en && entry.ru && entry.am, key).toBeTruthy();
  });

  test("audit actions read as distinct phrases in every language", () => {
    for (const lang of ["en", "ru", "am"] as const) {
      const words = Object.values(AUDIT_ACTION_LABEL_KEY).map((k) => TRANSLATIONS[k][lang]);
      expect(new Set(words).size, lang).toBe(words.length);
    }
  });
});
