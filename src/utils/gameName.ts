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
  catalogue: readonly IGameApi[] | undefined,
  name: string,
  platform: string,
): IGameApi | null => {
  const wanted = normalizeGameName(name);
  if (!wanted || !platform) return null;

  return (catalogue ?? []).find(
    (g) => g.platform === platform && normalizeGameName(g.name) === wanted,
  ) ?? null;
};
