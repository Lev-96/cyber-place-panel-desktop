/**
 * PSN names this panel has started PlayStation sessions for, newest first, so
 * a regular's name is picked rather than typed again (2026-10-12).
 *
 * A typing aid and nothing more: per machine, never sent anywhere, and a
 * storage that throws (private mode, blocked site data) just means no
 * suggestions.
 */
const KEY = "cp.psn.recentNames";
const LIMIT = 30;

export const recentPsnNames = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string").slice(0, LIMIT) : [];
  } catch {
    return [];
  }
};

export const rememberPsnName = (name: string): void => {
  try {
    const rest = recentPsnNames().filter((n) => n.toLowerCase() !== name.toLowerCase());
    localStorage.setItem(KEY, JSON.stringify([name, ...rest].slice(0, LIMIT)));
  } catch {
    // No storage, no suggestions; the session itself is unaffected.
  }
};
