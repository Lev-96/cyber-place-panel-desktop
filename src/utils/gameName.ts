import type { IGameApi } from "@/api/games";

/**
 * The comparable form of a game name: trimmed, lower-cased, inner runs of
 * whitespace collapsed to one space — so "Dota  2 ", "dota 2" and "DOTA 2"
 * are the same game.
 */
export const normalizeGameName = (name: string): string =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The catalogue row a new game would duplicate (same normalised name, same
 * platform), or null.
 *
 * ADVICE only: it saves the operator a round-trip when the duplicate is
 * already on screen. The server's 422 `game_exists` is what decides, and a
 * catalogue loaded a minute ago may be stale either way.
 */
export const findExistingGame = (
  catalogue: readonly IGameApi[] | null | undefined,
  name: string,
  platform: string,
): IGameApi | null => {
  const wanted = normalizeGameName(name);
  if (!wanted || !platform) return null;

  return (catalogue ?? []).find(
    (g) => g.platform === platform && normalizeGameName(g.name) === wanted,
  ) ?? null;
};

/** How many existing games the create form offers while a name is typed. */
export const GAME_SUGGESTION_LIMIT = 5;
/** Shorter than this, a prefix matches too much of the catalogue to help. */
export const GAME_SUGGESTION_MIN_CHARS = 2;

/**
 * Existing games on `platform` whose normalised name contains the normalised
 * `query`: the exact name first, then names that start with it, then the rest,
 * each group alphabetical. At most {@link GAME_SUGGESTION_LIMIT}; empty for a
 * query shorter than {@link GAME_SUGGESTION_MIN_CHARS} or with no platform.
 *
 * Same rule as {@link findExistingGame} (whose hit is always the first row
 * here), so what the form suggests and what Save would flag never disagree.
 */
export const suggestGames = (
  catalogue: readonly IGameApi[] | null | undefined,
  query: string,
  platform: string,
  limit = GAME_SUGGESTION_LIMIT,
): IGameApi[] => {
  const wanted = normalizeGameName(query);
  if (wanted.length < GAME_SUGGESTION_MIN_CHARS || !platform) return [];

  const seen = new Set<number>();
  const ranked: { game: IGameApi; key: string; rank: number }[] = [];
  for (const game of catalogue ?? []) {
    if (game.platform !== platform || seen.has(game.id)) continue;
    const key = normalizeGameName(game.name);
    const at = key.indexOf(wanted);
    if (at < 0) continue;
    seen.add(game.id);
    ranked.push({ game, key, rank: key === wanted ? 0 : at === 0 ? 1 : 2 });
  }

  return ranked
    .sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((r) => r.game);
};
