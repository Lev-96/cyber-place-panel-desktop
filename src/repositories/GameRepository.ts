import { apiCreateGame, apiDeleteGame, apiListGames, apiUpdateGame, CreateGameBody, GameWriteResponse, IGameApi } from "@/api/games";
import { withToast } from "@/ui/notify";

const ALL = 500;

export interface GameListOptions {
  /** Filter to a single platform slug (pc / ps4 / ps5 or a custom slug). */
  platform?: string;
  /** Scope to games attached to this branch via the game_branches pivot. */
  branchId?: number;
}

export class GameRepository {
  list(opts: GameListOptions = {}) {
    return apiListGames({ platform: opts.platform, branch_id: opts.branchId, per_page: ALL }).then((r) => r.data);
  }
  /**
   * Resolves with the saved row when the endpoint returns one, otherwise null
   * (see {@link GameWriteResponse}) — callers that only need "it worked" can
   * ignore it, callers that want to pre-select the new game can use it.
   */
  create(b: CreateGameBody) { return withToast("game", "created", () => apiCreateGame(b).then(savedGame)); }
  update(id: number, b: Partial<CreateGameBody>) { return withToast("game", "updated", () => apiUpdateGame(id, b).then(savedGame)); }
  remove(id: number) { return withToast("game", "deleted", () => apiDeleteGame(id).then(() => undefined)); }
}

/** The saved row from a write response, whichever key the endpoint used. */
const savedGame = (r: GameWriteResponse): IGameApi | null => r.games ?? r.game ?? null;

export const gameRepository = new GameRepository();
