import { PlatformType } from "@/types/api";

/**
 * The three platforms with first-class behaviour: a tariff matrix cell
 * (`{platform}-{type}` in price_for_branches), a games catalogue, and — for
 * `pc` — the kiosk agent. Everything else is a *custom* platform the branch
 * invents (table tennis, poker, VR, …): billing-only, manual rate, still a
 * fully dynamic entry across places / games / mobile booking.
 */
export const KNOWN_PLATFORMS: readonly PlatformType[] = ["pc", "ps4", "ps5"];

export const isKnownPlatform = (p: string): p is PlatformType =>
  (KNOWN_PLATFORMS as readonly string[]).includes(p);

/**
 * Normalise free-typed platform text into the lowercase slug the backend
 * accepts (`^[a-z0-9][a-z0-9-]*$`). Applied on every keystroke so what the
 * operator sees is exactly what gets stored — "Table Tennis" → "table-tennis".
 * Leading dashes are stripped (the slug must start alphanumeric); a trailing
 * dash is left alone so mid-word typing isn't fought.
 */
export const slugifyPlatform = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "");

/**
 * Human label for any platform: known ones stay upper-cased (PC / PS4 / PS5),
 * a custom slug is de-slugged into Title Case ("table-tennis" → "Table Tennis").
 */
export const platformLabel = (p: string): string =>
  isKnownPlatform(p)
    ? p.toUpperCase()
    : p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Broad bucket a platform belongs to, used to group the sessions board into
 * collapsible sections. "ps" is GLOBAL across every PlayStation generation
 * (ps4, ps5, ps6, …) — matched by the `ps<digits>` shape — so a new console
 * generation slots in with no code change here. Everything that isn't pc or a
 * PlayStation (table-tennis, poker, vr, …) falls into "other".
 */
export type PlatformGroup = "pc" | "ps" | "other";

export const platformGroup = (platform: string): PlatformGroup => {
  if (platform === "pc") return "pc";
  if (/^ps\d*$/i.test(platform)) return "ps";
  return "other";
};
