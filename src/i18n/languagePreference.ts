import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { Lang, LANGUAGES } from "@/i18n/translations";

/**
 * Persistence + policy for the language-selection flow.
 *
 * Split out of LanguageContext deliberately: these are pure async functions
 * over the key-value store, so the whole policy ("has this person chosen yet?",
 * "should the workspace ask again?") is unit-testable without mounting React or
 * an Electron bridge.
 *
 * Two storage scopes, matching the convention the panel already uses for
 * per-user UI state (`u{id}:key`):
 *
 *   cp.lang / cp.lang.chosen   — MACHINE scope. The language the app boots in,
 *                                picked on first run before anyone has logged
 *                                in. There is no user yet at that point, so it
 *                                cannot be per-user.
 *   u{id}:cp.panelLang         — USER scope. The language confirmed for that
 *                                account's workspace. A shared front-desk
 *                                machine may be used by a Russian-speaking
 *                                manager on one shift and an Armenian-speaking
 *                                owner on the next; keying by user is what
 *                                stops one overwriting the other.
 */

const KEY_LANG = "cp.lang";
const KEY_LANG_CHOSEN = "cp.lang.chosen";
const KEY_PANEL_LANG = (userId: number): string => `u${userId}:cp.panelLang`;

/**
 * How often the workspace step asks.
 *
 * `always` — every time an owner/manager session starts (app launch or login).
 *            This is what the product spec asks for, and it is the default so
 *            that what ships matches what was specified.
 * `once`   — ask the first time only, then remember per user.
 *
 * Recommendation is `once`: the choice is already persisted and changeable from
 * Settings at any moment, so re-asking on every launch is an interruption that
 * buys nothing — and a prompt a user answers identically every day is a prompt
 * they stop reading. Flip this constant to change the behaviour; nothing else
 * needs to move.
 */
export const PANEL_LANGUAGE_PROMPT: "always" | "once" = "always";

/** Roles that get the workspace language step. Admin is deliberately excluded. */
export const PANEL_LANGUAGE_ROLES = ["company_owner", "manager"] as const;

const isLang = (v: unknown): v is Lang =>
  typeof v === "string" && LANGUAGES.some((l) => l.code === v);

/** The language the app should boot in, or null when nobody has ever chosen. */
export const readStoredLang = async (): Promise<Lang | null> => {
  const stored = await keyValueStore.get<Lang>(KEY_LANG);
  return isLang(stored) ? stored : null;
};

/**
 * Has a human explicitly chosen the app language?
 *
 * Tracked with its own flag rather than inferred from `cp.lang` being present,
 * because any future code path that writes a *default* language would otherwise
 * silently suppress the first-run screen. An explicit flag can only be set by
 * someone clicking a language.
 */
export const hasChosenLang = async (): Promise<boolean> =>
  (await keyValueStore.get<boolean>(KEY_LANG_CHOSEN)) === true;

/** Persist a first-run / Settings choice. */
export const rememberLang = async (lang: Lang): Promise<void> => {
  await keyValueStore.set(KEY_LANG, lang);
  await keyValueStore.set(KEY_LANG_CHOSEN, true);
};

/** The language this user last confirmed for their workspace, if any. */
export const readPanelLang = async (userId: number): Promise<Lang | null> => {
  const stored = await keyValueStore.get<Lang>(KEY_PANEL_LANG(userId));
  return isLang(stored) ? stored : null;
};

export const rememberPanelLang = async (userId: number, lang: Lang): Promise<void> => {
  await keyValueStore.set(KEY_PANEL_LANG(userId), lang);
  // The workspace choice is also the app language from here on — one active
  // language, not two competing ones (see the note in LanguageGates).
  await rememberLang(lang);
};

/** Does this role get the workspace language step at all? */
export const roleNeedsPanelLanguage = (role: string | undefined): boolean =>
  PANEL_LANGUAGE_ROLES.includes(role as (typeof PANEL_LANGUAGE_ROLES)[number]);

/**
 * Should the workspace step be shown for this user right now?
 *
 * Under the `always` policy the answer is yes for every eligible role — the
 * caller shows it once per session, not once per navigation, so "always" means
 * "every time they start working", never "every time they click a link".
 */
export const shouldPromptPanelLanguage = async (
  role: string | undefined,
  userId: number,
): Promise<boolean> => {
  if (!roleNeedsPanelLanguage(role)) return false;
  if (PANEL_LANGUAGE_PROMPT === "always") return true;

  return (await readPanelLang(userId)) === null;
};
