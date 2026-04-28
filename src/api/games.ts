import { PaginatedList, PlatformType } from "@/types/api";
import { request } from "./client";

export interface IGameApi {
  id: number;
  name: string;
  platform: PlatformType;
  game_logo_path?: string;
  created_at?: string;
}

export interface CreateGameBody {
  name: string;
  platform: PlatformType;
}

export const apiListGames = (params: { platform?: PlatformType; per_page?: number; page?: number } = {}) =>
  request<PaginatedList<IGameApi>>("/games", { params });

export const apiCreateGame = (body: CreateGameBody) =>
  request<{ game: IGameApi }>("/games", { method: "POST", body });

export const apiUpdateGame = (id: number, body: Partial<CreateGameBody>) =>
  request<{ game: IGameApi }>(`/games/${id}`, { method: "PUT", body });

export const apiDeleteGame = (id: number) =>
  request<{ message: string }>(`/games/${id}`, { method: "DELETE" });
