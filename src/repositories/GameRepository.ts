import { apiCreateGame, apiDeleteGame, apiListGames, apiUpdateGame, CreateGameBody, IGameApi } from "@/api/games";
import { PlatformType } from "@/types/api";
import { withToast } from "@/ui/notify";

const ALL = 500;

export class GameRepository {
  list(platform?: PlatformType) { return apiListGames({ platform, per_page: ALL }).then((r) => r.data); }
  create(b: CreateGameBody) { return withToast("game", "created", () => apiCreateGame(b).then((r) => r.game)); }
  update(id: number, b: Partial<CreateGameBody>) { return withToast("game", "updated", () => apiUpdateGame(id, b).then((r) => r.game)); }
  remove(id: number) { return withToast("game", "deleted", () => apiDeleteGame(id).then(() => undefined)); }
}

export const gameRepository = new GameRepository();
