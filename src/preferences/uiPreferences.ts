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
/**
 * Colour themes (2026-11-04, owner: more of them, all easy on the eyes in a
 * club with the lights down — "light" softened because white hurt). The
 * server keeps the same list (`App\Support\UiPreferences::THEMES`).
 */
export const THEMES = ["dark", "light", "contrast", "purple", "midnight", "emerald", "amber"] as const;
export const DENSITIES = ["simple", "standard", "compact"] as const;
export const CARD_SIZES = ["s", "m", "l"] as const;
export const BOARD_VIEWS = ["grid", "list"] as const;
export const QUICK_ACTIONS = ["all", "primary"] as const;
/**
 * How the Active Places buttons are labelled (2026-11-04): "auto" — words,
 * and pictures where a list row is too narrow for them (the behaviour so
 * far); "icons" — pictures always; "text" — words always. The full name is
 * the button's tooltip and accessible name in every case.
 */
export const BUTTON_LABELS = ["auto", "icons", "text"] as const;
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
export type ButtonLabels = (typeof BUTTON_LABELS)[number];
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
  /** Words, pictures, or words that become pictures when a row is too narrow. */
  button_labels: ButtonLabels;
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

/**
 * The Active Places board's own spacing, part of «Мой интерфейс». Kept on
 * THIS computer (`boardKey`), never in the server document: the server
 * refuses any key it does not list (422), and this is display only.
 *
 * Only the space between rows since 2026-11-04 (owner): the card size, «Без
 * прокрутки», the side spacing and the column count are gone from the screen,
 * and a value kept from before is no longer applied — a setting nobody can
 * see is a setting nobody can change back.
 */
export interface BoardGeometry {
  /** Space between rows, px; null = what the density gives. */
  gap_y: number | null;
}

export interface UiPreferences {
  interface: InterfaceId;
  theme: ThemeId;
  /** The person's own layout ("Мой интерфейс"); used when interface = custom. */
  layout: Layout;
  sound: SoundPrefs;
  /** The person's own board geometry; used when interface = custom. Local only. */
  board: BoardGeometry;
}

/** The local board document's format; bumped only with a breaking change. */
export const BOARD_SCHEMA_VERSION = 1;
/**
 * Gap limits, from the board itself: the density gaps (36 / 42 / 54) sit
 * inside; 8 still keeps two cards' edges apart; past 64 a 1280px window loses
 * a column to air alone. Steps of 4, the panel's spacing scale.
 */
export const GAP_LIMITS = { min: 8, max: 64, step: 4 } as const;
export const BOARD_DEFAULTS: BoardGeometry = { gap_y: null };

const gapOf = (v: unknown): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const snapped = Math.round(v / GAP_LIMITS.step) * GAP_LIMITS.step;
  return Math.min(GAP_LIMITS.max, Math.max(GAP_LIMITS.min, snapped));
};

/**
 * Read the local board document. Never throws; a value out of range is
 * brought inside it, anything else unreadable falls back to the standard.
 * Reads `gap_y` only: the fields an older build wrote (`gap_x`, `columns`,
 * `scale`, `fit`) are left unread, so they stop applying (2026-11-04).
 */
export const parseBoard = (raw: unknown): BoardGeometry => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ...BOARD_DEFAULTS };
  const o = raw as Record<string, unknown>;
  return { gap_y: o.gap_y === null ? null : gapOf(o.gap_y) };
};

/** The board document as kept on this computer. */
export const toBoardDocument = (b: BoardGeometry) => ({ v: BOARD_SCHEMA_VERSION, ...b });

/** The geometry in force: the person's own with «Мой интерфейс», else the standard. */
export const effectiveBoard = (p: UiPreferences): BoardGeometry =>
  p.interface === "custom" ? p.board : BOARD_DEFAULTS;

export const isDefaultBoard = (b: BoardGeometry) => b.gap_y === null;

/** Same look: the server document AND this computer's board (2026-11-03). */
export const sameLook = (a: UiPreferences, b: UiPreferences): boolean =>
  JSON.stringify(toDocument(a)) === JSON.stringify(toDocument(b))
  && JSON.stringify(a.board) === JSON.stringify(b.board);

/**
 * The person has an interface of their own (2026-11-03): «Мой интерфейс» is
 * on, or kept aside with something of their own in it: a layout that is not
 * one of the ready-made ones (the first-run setup stores the one picked), or
 * a board of their own. Derived, not stored: nothing new on the server.
 */
export const hasOwnInterface = (p: UiPreferences): boolean => {
  if (p.interface === "custom" || !isDefaultBoard(p.board)) return true;
  const mine = JSON.stringify(p.layout);
  return !Object.values(PRESETS).some((preset) => JSON.stringify(preset) === mine);
};

/** The three ready-made interfaces: frozen layouts over the same screens. */
export const PRESETS: Record<Exclude<InterfaceId, "custom">, Layout> = {
  simple: {
    density: "simple", card_size: "l", board_view: "grid", show_secondary: false,
    quick_actions: "primary", button_labels: "auto", home: null, sidebar: [],
  },
  standard: {
    density: "standard", card_size: "m", board_view: "grid", show_secondary: true,
    quick_actions: "all", button_labels: "auto", home: null, sidebar: [],
  },
  // Compact is rows (2026-10-27): more places on one screen, every action
  // in the row — a different board, not a smaller copy of the standard one.
  compact: {
    density: "compact", card_size: "s", board_view: "list", show_secondary: true,
    quick_actions: "all", button_labels: "auto", home: null, sidebar: [],
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
  board: BOARD_DEFAULTS,
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
    button_labels: oneOf(BUTTON_LABELS, o.button_labels, base.button_labels),
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
    // Never in the server document: the provider reads it from this computer.
    board: { ...fallback.board },
  };
};

/** The layout actually in force: a ready-made interface's, or the person's own. */
export const effectiveLayout = (p: UiPreferences): Layout =>
  p.interface === "custom" ? p.layout : PRESETS[p.interface];

/**
 * The document as the server stores it (`App\Support\UiPreferences`). Lists
 * the server's keys on purpose: `board` stays out (the server would refuse
 * the whole document with a 422).
 */
export const toDocument = (p: UiPreferences) => ({
  interface: p.interface,
  theme: p.theme,
  layout: layoutDocument(p.layout),
  sound: p.sound,
});

/**
 * The layout as stored: `button_labels` only when it is not the default
 * (2026-11-04). Absent reads back as "auto" (`parseLayout`), and a document
 * without it is one a backend that predates the key still accepts — so only
 * a person who actually chose Icons or Text needs the new backend.
 */
const layoutDocument = (l: Layout) => {
  if (l.button_labels !== "auto") return l;
  const { button_labels: _auto, ...rest } = l;
  return rest;
};
