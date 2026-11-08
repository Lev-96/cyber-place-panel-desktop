import { describe, expect, test } from "vitest";
import {
  DEFAULT_PREFERENCES, LEGACY_NOTIFICATIONS, effectiveNotifications, parseNotifications, parsePreferences, toDocument,
} from "./uiPreferences";

/**
 * The owner's notification settings ride in the preference document
 * (2026-11-09, `data.notifications`). Two rules:
 *
 *  - a document WITHOUT the block reads as legacy (everything on, platform
 *    payments on) and is written back WITHOUT it, so a backend that predates
 *    the setting (it refuses unknown keys with a 422) keeps accepting every
 *    save of the look;
 *  - a document WITH the block keeps it on every save of the look.
 */
describe("parse", () => {
  test("no block is legacy: null stored, everything on in force", () => {
    for (const raw of [{}, { theme: "light" }, null, { notifications: null }, { notifications: "on" }, { notifications: [] }]) {
      const p = parsePreferences(raw);
      expect(p.notifications).toBeNull();
      expect(effectiveNotifications(p)).toEqual(LEGACY_NOTIFICATIONS);
    }
    expect(LEGACY_NOTIFICATIONS.categories.platform_billing).toEqual({ enabled: true, email: true, telegram: true });
    for (const c of ["bookings", "sessions", "support", "system"] as const) {
      expect(LEGACY_NOTIFICATIONS.categories[c].enabled).toBe(true);
    }
  });

  test("a new owner's explicit block is read as stored", () => {
    const stored = {
      categories: {
        bookings: { enabled: false }, sessions: { enabled: false }, support: { enabled: false }, system: { enabled: false },
        platform_billing: { enabled: true, email: true, telegram: true },
      },
    };
    expect(parsePreferences({ notifications: stored }).notifications).toEqual(stored);
  });

  test("a partial block takes legacy values only for what it lacks", () => {
    const p = parseNotifications({ categories: { sessions: { enabled: false }, platform_billing: { telegram: false, email: "yes" } } });
    expect(p).toEqual({
      categories: {
        bookings: { enabled: true }, sessions: { enabled: false }, support: { enabled: true }, system: { enabled: true },
        platform_billing: { enabled: true, email: true, telegram: false },
      },
    });
  });
});

describe("serialise", () => {
  test("legacy: the document carries no notifications key at all", () => {
    const doc = toDocument(DEFAULT_PREFERENCES);
    expect(Object.keys(doc).sort()).toEqual(["interface", "layout", "sound", "theme"]);
    expect("notifications" in doc).toBe(false);
  });

  test("a stored block is always sent back, so saving the look never wipes it", () => {
    const notifications = parseNotifications({ categories: { bookings: { enabled: false } } })!;
    const doc = toDocument({ ...DEFAULT_PREFERENCES, theme: "amber", notifications });
    expect(doc.notifications).toEqual(notifications);
    // …and it round-trips.
    expect(parsePreferences(JSON.parse(JSON.stringify(doc))).notifications).toEqual(notifications);
  });
});
