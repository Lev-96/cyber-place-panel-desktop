import { apiCreateGame, apiDeleteGame, apiListGames, apiUpdateGame, CreateGameBody, GameWriteResponse, IGameApi } from "@/api/games";
import { existingGameOf } from "@/api/gameExists";
import { notify, withToast } from "@/ui/notify";

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
  async create(b: CreateGameBody): Promise<IGameApi | null> {
    try {
      const r = await apiCreateGame(b);
      notify.success("game", r.existing ? "linked" : "created");
      return savedGame(r);
    } catch (e) {
      // A duplicate is a QUESTION ("use the existing one?") that GameForm asks
      // inline. A red "could not create" toast on top of it would tell the
      // operator something broke when nothing did. Every other failure keeps
      // the toast, exactly as `withToast` raises it.
      if (!existingGameOf(e)) notify.error("game", "created");
      throw e;
    }
  }
  update(id: number, b: Partial<CreateGameBody>) { return withToast("game", "updated", () => apiUpdateGame(id, b).then(savedGame)); }
  remove(id: number) { return withToast("game", "deleted", () => apiDeleteGame(id).then(() => undefined)); }
}

/** The saved row from a write response, whichever key the endpoint used. */
const savedGame = (r: GameWriteResponse): IGameApi | null => r.games ?? r.game ?? null;

export const gameRepository = new GameRepository();
