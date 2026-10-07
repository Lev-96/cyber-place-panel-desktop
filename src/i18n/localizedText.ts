/**
 * Text a screen keeps in state to show later — an error, a notice — held by
 * what it MEANS rather than as the sentence it was at that moment (2026-10-07).
 *
 * A screen that stores `t("login.invalidCredentials")` keeps the sentence in
 * the language of the moment it failed; switching the language on that very
 * screen then leaves the message behind in the old one. Stored as a key, it is
 * translated at render time and follows the switch.
 *
 * A server sentence with no key of ours (a refusal code newer than this build,
 * a 5xx) is kept as it came — `literal` — because it is the only text there
 * is; it is already in the language the request was made in.
 */
export type LocalizedText = { key: string } | { literal: string };

export const textKey = (key: string): LocalizedText => ({ key });
export const textLiteral = (literal: string): LocalizedText => ({ literal });

/**
 * The text in the active language. `translate` is the screen's own `t` (or a
 * wrapper over several dictionaries), passed in so this stays free of React.
 */
export const renderText = (text: LocalizedText, translate: (key: string) => string): string =>
  "key" in text ? translate(text.key) : text.literal;
