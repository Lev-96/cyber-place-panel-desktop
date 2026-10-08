import type { ApiError } from "@/api/client";
import type { IGameApi } from "@/api/games";

/**
 * "This game is already in the catalogue" — a question for the operator, not
 * a failure.
 *
 * `POST /games` refuses a duplicate (same name, same platform) with a 422 that
 * still carries the usual `message` + `errors.name`, plus a stable
 * `code: "game_exists"` and the row that already exists. The panel reads the
 * code, never the sentence, and offers to use that row: resending the same
 * body with `use_existing: true` links the shared game to the branch.
 *
 * Shaped after `seatUnavailable.ts` / `blockingErrors.ts`. A backend from
 * before the code existed answers without it, so this returns null and the
 * form falls back to the field error it always showed.
 */

export const GAME_EXISTS_CODE = "game_exists";

/** The catalogue row the server says the operator is about to duplicate. */
export type ExistingGame = Pick<IGameApi, "id" | "name" | "platform">;

interface GameExistsBody {
  code?: unknown;
  game?: { id?: unknown; name?: unknown; platform?: unknown } | null;
}

/** The existing game from a refused create, or null for any other failure. */
export const existingGameOf = (error: unknown): ExistingGame | null => {
  const body = (error as ApiError | undefined)?.body;
  if (!body || typeof body !== "object") return null;

  const { code, game } = body as GameExistsBody;
  if (code !== GAME_EXISTS_CODE || !game || typeof game !== "object") return null;

  const { id, name, platform } = game;
  return typeof id === "number" && typeof name === "string" && typeof platform === "string"
    ? { id, name, platform }
    : null;
};
