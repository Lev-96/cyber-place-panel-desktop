import { describe, expect, test } from "vitest";
import {
  DEFAULT_PREFERENCES, NEW_PERSON_PREFERENCES, PRESETS, SOUND_DEFAULTS, effectiveLayout, parsePreferences, toDocument,
} from "./uiPreferences";

/**
 * Reading a stored interface document (2026-10-27): whatever arrives —
 * nothing, an old version, a broken one, a hostile one — the panel gets
 * preferences it understands, field by field, and never an exception.
 */
describe("parsePreferences", () => {
  test("nothing stored is the interface a person already knows", () => {
    for (const raw of [null, undefined, "", 42, [], "{"]) {
      expect(parsePreferences(raw)).toEqual(DEFAULT_PREFERENCES);
    }
    expect(DEFAULT_PREFERENCES.interface).toBe("standard");
    expect(NEW_PERSON_PREFERENCES.interface).toBe("simple");
  });

  test("a valid document round-trips", () => {
    const doc = toDocument({ ...DEFAULT_PREFERENCES, interface: "custom", theme: "contrast",
      layout: { ...PRESETS.compact, home: "/bookings", sidebar: [{ id: "bookings", hidden: true }] } });
    // The SERVER document round-trips (the local-only board is not part of it).
    expect(toDocument(parsePreferences(JSON.parse(JSON.stringify(doc))))).toEqual(doc);
  });

  test("one bad field costs only that field", () => {
    const p = parsePreferences({ interface: "admin", theme: "light", layout: { density: "huge", card_size: "s" } });
    expect(p.interface).toBe("standard");
    expect(p.theme).toBe("light");
    expect(p.layout.density).toBe("standard");
    expect(p.layout.card_size).toBe("s");
  });

  test("nothing that is not a display choice survives", () => {
    const p = parsePreferences({
      layout: {
        home: "https://evil.test", sidebar: [
          { id: "../x", hidden: false }, { id: "bookings", hidden: "yes" }, { id: "bookings", hidden: true },
          { id: "shifts", hidden: true, onClick: "steal()" }, "notes",
        ],
      },
      permissions: ["shift.manage"],
      sound: { profile: "deafening", categories: { booking_new: { enabled: true, sound: "https://x/y.mp3" }, unknown: {} } },
    });
    expect(p.layout.home).toBeNull();
    expect(p.layout.sidebar).toEqual([{ id: "bookings", hidden: false }, { id: "shifts", hidden: true }]);
    expect(p).not.toHaveProperty("permissions");
    expect(p.sound.profile).toBe("standard");
    expect(p.sound.categories.booking_new.sound).toBe(SOUND_DEFAULTS.booking_new.sound);
    expect(Object.keys(p.sound.categories)).not.toContain("unknown");
    // A sound this build no longer offers (the short synthesised ones of
    // 2026-10-27 morning) falls back to the default, not to an error.
    const old = parsePreferences({ sound: { categories: { support: { enabled: true, sound: "pop" } } } });
    expect(old.sound.categories.support).toEqual({ enabled: true, sound: SOUND_DEFAULTS.support.sound });
  });

  /**
   * The server refuses the WHOLE save (422, "data.sound.categories должно
   * быть массивом") for a category it does not list, so the document must
   * name exactly the server's (`App\Support\UiPreferences::SOUND_CATEGORIES`).
   * 2026-11-07: `session_unpaid` reached the panel first and every save,
   * a theme alone, failed. Adding a category here means adding it there.
   */
  test("the document names exactly the sound categories the server accepts", () => {
    const server = ["booking_new", "booking_changed", "session_ending", "session_unpaid", "support", "guests", "system", "platform_billing"];
    expect(Object.keys(toDocument(DEFAULT_PREFERENCES).sound.categories)).toEqual(server);
    expect(Object.keys(toDocument(parsePreferences({ theme: "light" })).sound.categories)).toEqual(server);
  });

  test("a document saved before session_unpaid keeps its sounds and gains the new one's default", () => {
    const p = parsePreferences({ theme: "amber", sound: { profile: "loud", categories: {
      booking_new: { enabled: false, sound: "bell" }, support: { enabled: true, sound: "space" },
    } } });
    expect(p.theme).toBe("amber");
    expect(p.sound.profile).toBe("loud");
    expect(p.sound.categories.booking_new).toEqual({ enabled: false, sound: "bell" });
    expect(p.sound.categories.support).toEqual({ enabled: true, sound: "space" });
    expect(p.sound.categories.session_unpaid).toEqual(SOUND_DEFAULTS.session_unpaid);
  });

  test("changing the theme keeps every sound, changing a sound keeps the theme", () => {
    const saved = parsePreferences({ theme: "emerald", sound: { profile: "custom", categories: {
      session_unpaid: { enabled: false, sound: "beep" } } } });
    const themed = toDocument({ ...saved, theme: "purple" });
    expect(themed.sound).toEqual(toDocument(saved).sound);
    const sounded = toDocument({ ...saved, sound: { ...saved.sound, categories: {
      ...saved.sound.categories, session_unpaid: { enabled: true, sound: "beep" } } } });
    expect(sounded.theme).toBe("emerald");
    expect(sounded.sound.categories.session_unpaid).toEqual({ enabled: true, sound: "beep" });
  });

  test("a menu is capped at 60 entries", () => {
    const sidebar = Array.from({ length: 80 }, (_, i) => ({ id: `item${i}`, hidden: false }));
    expect(parsePreferences({ layout: { sidebar } }).layout.sidebar).toHaveLength(60);
  });
});

describe("effectiveLayout", () => {
  test("a ready-made interface is its preset, whatever the stored layout says", () => {
    const stored = { ...PRESETS.compact, quick_actions: "primary" as const };
    expect(effectiveLayout({ ...DEFAULT_PREFERENCES, interface: "simple", layout: stored })).toEqual(PRESETS.simple);
    expect(effectiveLayout({ ...DEFAULT_PREFERENCES, interface: "custom", layout: stored })).toEqual(stored);
  });

  test("the three interfaces really differ", () => {
    expect(PRESETS.simple.quick_actions).toBe("primary");
    expect(PRESETS.simple.show_secondary).toBe(false);
    expect(new Set([PRESETS.simple.density, PRESETS.standard.density, PRESETS.compact.density]).size).toBe(3);
  });
});
