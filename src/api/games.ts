import { PaginatedList } from "@/types/api";
import { request } from "./client";

// NOTE: `platform` is a dynamic string now (known pc/ps4/ps5 OR a custom
// branch slug like "table-tennis"), not the closed PlatformType union.
export interface IGameApi {
  id: number;
  name: string;
  platform: string;
  game_logo_path?: string;
  created_at?: string;
}

export interface CreateGameBody {
  name: string;
  platform: string;
  /** Optional: scope the game to a branch via the game_branches pivot. */
  branch_id?: number;
}

export const apiListGames = (params: { platform?: string; branch_id?: number; per_page?: number; page?: number } = {}) =>
  request<PaginatedList<IGameApi>>("/games", { params });

/**
 * Write responses are NOT uniformly shaped by the backend: `store` returns the
 * created row wrapped by `Games\StoreResource` (`$wrap = 'games'`), while
 * `update` answers with a bare `{message}`. Both keys are optional here so a
 * caller can read the row when there is one and never assumes it exists —
 * `GameRepository` normalises this to `IGameApi | null`.
 */
export interface GameWriteResponse {
  games?: IGameApi;
  game?: IGameApi;
  message?: string;
}

export const apiCreateGame = (body: CreateGameBody) =>
  request<GameWriteResponse>("/games", { method: "POST", body });

export const apiUpdateGame = (id: number, body: Partial<CreateGameBody>) =>
  request<GameWriteResponse>(`/games/${id}`, { method: "PUT", body });

export const apiDeleteGame = (id: number) =>
  request<{ message: string }>(`/games/${id}`, { method: "DELETE" });
