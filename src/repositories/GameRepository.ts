import { apiCreateGame, apiDeleteGame, apiListGames, apiUpdateGame, CreateGameBody, IGameApi } from "@/api/games";
import { PlatformType } from "@/types/api";

export class GameRepository {
  list(platform?: PlatformType) { return apiListGames({ platform, per_page: 200 }).then((r) => r.data); }
  create(b: CreateGameBody) { return apiCreateGame(b).then((r) => r.game); }
  update(id: number, b: Partial<CreateGameBody>) { return apiUpdateGame(id, b).then((r) => r.game); }
  remove(id: number) { return apiDeleteGame(id).then(() => undefined); }
}

export const gameRepository = new GameRepository();
