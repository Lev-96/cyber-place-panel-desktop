/**
 * A person's desktop interface (2026-10-27): which ready-made interface they
 * use (or their own), the theme, the layout of that interface, and the
 * notification sounds — kept on the server with the person
 * (`GET/PUT /user/preferences`), so it follows them to any front-desk PC.
 *
 * Display only. Nothing here grants, hides or changes what a person may do:
 * permissions stay `can()`'s, every action stays its screen's. A value this
 * build does not know — an older or newer document, a hand-edited one, a
 * broken one — falls back to the default for that one field, never to an
 * error and never to a blank screen.
 */

export const SCHEMA_VERSION = 1;
/** Bumped when the first-run setup gains a step worth showing again. */
export const ONBOARDING_VERSION = 1;

export const INTERFACES = ["simple", "standard", "compact", "custom"] as const;
export const THEMES = ["dark", "light", "contrast"] as const;
export const DENSITIES = ["simple", "standard", "compact"] as const;
export const CARD_SIZES = ["s", "m", "l"] as const;
export const BOARD_VIEWS = ["grid", "list"] as const;
export const QUICK_ACTIONS = ["all", "primary"] as const;
export const SOUND_PROFILES = ["quiet", "standard", "loud", "custom"] as const;
/**
 * Only kinds of notification a real event feeds (2026-10-27): there is no
 * sale event in the system, so there is no sale sound to offer.
 */
export const SOUND_CATEGORIES = ["booking_new", "booking_changed", "session_ending", "support", "guests", "system"] as const;
/** The panel's own sounds, synthesised in code (the first three are the old ones, note for note). */
export const SYNTH_SOUNDS = ["chime", "soft", "ding", "bell", "pulse", "alert"] as const;
/**
 * Recorded melodies shipped with the panel (`public/sounds/<id>.mp3`,
 * 2026-10-27, chosen by the owner): trimmed and levelled to one loudness.
 */
export const FILE_SOUNDS = [
  "melodic", "message", "arrival", "newmsg", "sms", "messenger", "chat", "note",
  "chord", "calm", "social", "woohoo", "beep", "digital", "space",
] as const;
/** Every sound a person can choose, the recorded ones first. */
export const SOUNDS = [...FILE_SOUNDS, ...SYNTH_SOUNDS] as const;

export type InterfaceId = (typeof INTERFACES)[number];
export type ThemeId = (typeof THEMES)[number];
export type Density = (typeof DENSITIES)[number];
export type CardSize = (typeof CARD_SIZES)[number];
export type BoardView = (typeof BOARD_VIEWS)[number];
export type QuickActions = (typeof QUICK_ACTIONS)[number];
export type SoundProfile = (typeof SOUND_PROFILES)[number];
export type SoundCategory = (typeof SOUND_CATEGORIES)[number];
export type SynthSoundId = (typeof SYNTH_SOUNDS)[number];
export type FileSoundId = (typeof FILE_SOUNDS)[number];
export type SoundId = SynthSoundId | FileSoundId;

export interface SidebarEntry {
  id: string;
  hidden: boolean;
}

export interface Layout {
  density: Density;
  card_size: CardSize;
  board_view: BoardView;
  /** Secondary lines on a card (rate, plan, items) — off in Simple. */
  show_secondary: boolean;
  /** "all": every card action shown; "primary": the main ones + «Ещё». */
  quick_actions: QuickActions;
  /** The screen the panel opens on; null = the dashboard. */
  home: string | null;
  /** The person's menu order and hidden items; empty = the standard menu. */
  sidebar: SidebarEntry[];
}

export interface SoundCategoryPrefs {
  enabled: boolean;
  sound: SoundId;
}

export interface SoundPrefs {
  profile: SoundProfile;
  categories: Record<SoundCategory, SoundCategoryPrefs>;
}

export interface UiPreferences {
  interface: InterfaceId;
  theme: ThemeId;
  /** The person's own layout ("Мой интерфейс"); used when interface = custom. */
  layout: Layout;
  sound: SoundPrefs;
}

/** The three ready-made interfaces: frozen layouts over the same screens. */
export const PRESETS: Record<Exclude<InterfaceId, "custom">, Layout> = {
  simple: {
    density: "simple", card_size: "l", board_view: "grid", show_secondary: false,
    quick_actions: "primary", home: null, sidebar: [],
  },
  standard: {
    density: "standard", card_size: "m", board_view: "grid", show_secondary: true,
    quick_actions: "all", home: null, sidebar: [],
  },
  // Compact is rows (2026-10-27): more places on one screen, every action
  // in the row — a different board, not a smaller copy of the standard one.
  compact: {
    density: "compact", card_size: "s", board_view: "list", show_secondary: true,
    quick_actions: "all", home: null, sidebar: [],
  },
};

/**
 * The sounds a person hears before choosing any (2026-10-27, owner: modern
 * melodies, long enough to be heard at a busy counter): a different recorded
 * melody per kind, so a bell for a seat running out is told apart from a new
 * booking without looking. A person's own choice always wins.
 */
export const SOUND_DEFAULTS: Record<SoundCategory, SoundCategoryPrefs> = {
  booking_new: { enabled: true, sound: "melodic" },
  booking_changed: { enabled: true, sound: "message" },
  session_ending: { enabled: true, sound: "digital" },
  support: { enabled: true, sound: "chat" },
  guests: { enabled: true, sound: "chord" },
  system: { enabled: true, sound: "calm" },
};

export const defaultSound = (): SoundPrefs => ({
  profile: "standard",
  categories: structuredClone(SOUND_DEFAULTS),
});

/** What a person who never chose anything gets: the interface they know. */
export const DEFAULT_PREFERENCES: UiPreferences = {
  interface: "standard",
  theme: "dark",
  layout: PRESETS.standard,
  sound: defaultSound(),
};

/** What the first-run setup offers a NEW person (owner decision 2026-10-27). */
export const NEW_PERSON_PREFERENCES: UiPreferences = {
  ...DEFAULT_PREFERENCES,
  interface: "simple",
  layout: PRESETS.simple,
};

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const HOME = /^\/[a-z0-9/_-]{0,80}$/;
const MAX_SIDEBAR = 60;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const parseLayout = (raw: unknown, base: Layout): Layout => {
  const o = isObject(raw) ? raw : {};
  const seen = new Set<string>();
  const sidebar = (Array.isArray(o.sidebar) ? o.sidebar : [])
    .filter((e): e is { id: string; hidden?: unknown } => isObject(e) && typeof e.id === "string" && ID.test(e.id))
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .slice(0, MAX_SIDEBAR)
    .map((e) => ({ id: e.id, hidden: e.hidden === true }));
  return {
    density: oneOf(DENSITIES, o.density, base.density),
    card_size: oneOf(CARD_SIZES, o.card_size, base.card_size),
    board_view: oneOf(BOARD_VIEWS, o.board_view, base.board_view),
    show_secondary: typeof o.show_secondary === "boolean" ? o.show_secondary : base.show_secondary,
    quick_actions: oneOf(QUICK_ACTIONS, o.quick_actions, base.quick_actions),
    home: typeof o.home === "string" && HOME.test(o.home) ? o.home : base.home,
    sidebar,
  };
};

const parseSound = (raw: unknown): SoundPrefs => {
  const o = isObject(raw) ? raw : {};
  const cats = isObject(o.categories) ? o.categories : {};
  const categories = Object.fromEntries(SOUND_CATEGORIES.map((c) => {
    const v = isObject(cats[c]) ? cats[c] as Record<string, unknown> : {};
    return [c, {
      enabled: typeof v.enabled === "boolean" ? v.enabled : SOUND_DEFAULTS[c].enabled,
      sound: oneOf(SOUNDS, v.sound, SOUND_DEFAULTS[c].sound),
    }];
  })) as Record<SoundCategory, SoundCategoryPrefs>;
  return { profile: oneOf(SOUND_PROFILES, o.profile, "standard"), categories };
};

/**
 * Read a stored document into preferences this build understands. Never
 * throws: anything missing, unknown or malformed takes its default, field by
 * field, so one bad value cannot cost the rest — or the app.
 */
export const parsePreferences = (raw: unknown, fallback: UiPreferences = DEFAULT_PREFERENCES): UiPreferences => {
  if (!isObject(raw)) return structuredClone(fallback);
  return {
    interface: oneOf(INTERFACES, raw.interface, fallback.interface),
    theme: oneOf(THEMES, raw.theme, fallback.theme),
    layout: parseLayout(raw.layout, fallback.layout),
    sound: isObject(raw.sound) ? parseSound(raw.sound) : structuredClone(fallback.sound),
  };
};

/** The layout actually in force: a ready-made interface's, or the person's own. */
export const effectiveLayout = (p: UiPreferences): Layout =>
  p.interface === "custom" ? p.layout : PRESETS[p.interface];

/** The document as the server stores it (`App\Support\UiPreferences`). */
export const toDocument = (p: UiPreferences) => ({
  interface: p.interface,
  theme: p.theme,
  layout: p.layout,
  sound: p.sound,
});
