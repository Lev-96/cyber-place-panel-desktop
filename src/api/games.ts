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
}

export const apiListGames = (params: { platform?: string; per_page?: number; page?: number } = {}) =>
  request<PaginatedList<IGameApi>>("/games", { params });

export const apiCreateGame = (body: CreateGameBody) =>
  request<{ game: IGameApi }>("/games", { method: "POST", body });

export const apiUpdateGame = (id: number, body: Partial<CreateGameBody>) =>
  request<{ game: IGameApi }>(`/games/${id}`, { method: "PUT", body });

export const apiDeleteGame = (id: number) =>
  request<{ message: string }>(`/games/${id}`, { method: "DELETE" });
