import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { Lang, LANGUAGES } from "@/i18n/translations";

/**
 * Persistence for the language-selection flow.
 *
 * Split out of LanguageContext deliberately: these are pure async functions
 * over the key-value store, so the whole policy ("has this account chosen
 * yet?") is unit-testable without mounting React or an Electron bridge.
 *
 * ── Two scopes, and which one is authoritative ────────────────────────────
 *
 *   u{id}:cp.lang   ACCOUNT scope, and the source of truth. Once someone is
 *                   signed in, their language follows the account — not the
 *                   machine. Two people sharing one front-desk PC each get
 *                   their own; the same person on a second PC gets theirs.
 *
 *   cp.lang         DEVICE scope. Used for exactly one thing: rendering the
 *                   LOGIN screen, where there is no account yet to read a
 *                   preference from. It is also the boot value, so the app
 *                   does not flash English before the account preference
 *                   loads. It never overrides an account's choice.
 *
 *   cp.lang.chosen  Whether a human has ever picked a language on this
 *                   machine — gates the pre-login picker.
 *
 * Every write goes through {@link rememberLang}, which mirrors into the active
 * account automatically. That is why changing the language in Settings persists
 * per account without Settings knowing anything about accounts.
 */

const KEY_DEVICE_LANG = "cp.lang";
const KEY_DEVICE_CHOSEN = "cp.lang.chosen";
const KEY_ACCOUNT_LANG = (userId: number): string => `u${userId}:cp.lang`;

const isLang = (v: unknown): v is Lang =>
  typeof v === "string" && LANGUAGES.some((l) => l.code === v);

/* ── Active account ─────────────────────────────────────────────────────── */

/**
 * Which account language writes should be attributed to.
 *
 * Module state rather than a prop because the write path is
 * `LanguageContext.setLang`, which is called from Settings, from both gates and
 * from anywhere else in the app. Threading a user id through every one of those
 * call sites would mean each could forget it — and a forgotten one silently
 * writes a device-only preference, which is the exact bug this design removes.
 */
let activeAccountId: number | null = null;

export const setActiveAccount = (userId: number | null): void => {
  activeAccountId = userId;
};

export const getActiveAccount = (): number | null => activeAccountId;

/* ── Pre-login choice hand-off ──────────────────────────────────────────── */

/**
 * The language picked on the login screen during THIS app run, if any.
 *
 * When the first account then signs in, it adopts this instead of being asked
 * again — the person chose a language seconds ago and asking twice in a row
 * reads as a broken app. Deliberately in-memory: on the next launch the device
 * preference must NOT be adopted by an unrelated account, because that account
 * genuinely has not chosen yet and is entitled to the picker.
 */
let preLoginChoice: Lang | null = null;

export const notePreLoginChoice = (lang: Lang): void => {
  preLoginChoice = lang;
};

/** Read and clear — a hand-off is consumed by exactly one account. */
export const takePreLoginChoice = (): Lang | null => {
  const value = preLoginChoice;
  preLoginChoice = null;
  return value;
};

/* ── Device scope (login screen only) ───────────────────────────────────── */

/** The language the app should boot in, or null when nobody has ever chosen. */
export const readStoredLang = async (): Promise<Lang | null> => {
  const stored = await keyValueStore.get<Lang>(KEY_DEVICE_LANG);
  return isLang(stored) ? stored : null;
};

/**
 * Has a human explicitly chosen a language on this machine?
 *
 * Tracked with its own flag rather than inferred from `cp.lang` being present,
 * because any future code path that writes a *default* language would otherwise
 * silently suppress the pre-login picker. An explicit flag can only be set by
 * someone clicking a language.
 */
export const hasChosenLang = async (): Promise<boolean> =>
  (await keyValueStore.get<boolean>(KEY_DEVICE_CHOSEN)) === true;

/* ── Account scope (authoritative) ──────────────────────────────────────── */

export const readAccountLang = async (userId: number): Promise<Lang | null> => {
  const stored = await keyValueStore.get<Lang>(KEY_ACCOUNT_LANG(userId));
  return isLang(stored) ? stored : null;
};

/** Has this account ever chosen? Drives whether the picker is shown at all. */
export const hasAccountLang = async (userId: number): Promise<boolean> =>
  (await readAccountLang(userId)) !== null;

export const rememberAccountLang = async (userId: number, lang: Lang): Promise<void> => {
  await keyValueStore.set(KEY_ACCOUNT_LANG(userId), lang);
};

/* ── The single write path ──────────────────────────────────────────────── */

/**
 * Persist a language choice, wherever it came from.
 *
 * Always writes the device scope (so the next login screen renders in it) and,
 * when someone is signed in, the account scope too — which is what makes the
 * account the source of truth from then on.
 */
export const rememberLang = async (lang: Lang): Promise<void> => {
  await keyValueStore.set(KEY_DEVICE_LANG, lang);
  await keyValueStore.set(KEY_DEVICE_CHOSEN, true);

  if (activeAccountId !== null) {
    await rememberAccountLang(activeAccountId, lang);
  }
};
