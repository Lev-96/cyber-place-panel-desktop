import { describe, expect, test } from "vitest";
import {
  DEFAULT_PREFERENCES, NEW_PERSON_PREFERENCES, PRESETS, effectiveLayout, parsePreferences, toDocument,
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
    expect(parsePreferences(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
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
    expect(p.sound.categories.booking_new.sound).toBe("chime");
    expect(Object.keys(p.sound.categories)).not.toContain("unknown");
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
