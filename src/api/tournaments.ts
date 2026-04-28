import { PaginatedList } from "@/types/api";
import { request } from "./client";

/**
 * Wire schema (matches backend `tournaments` table + StoreRequest):
 *   title, description (REQUIRED), price (REQUIRED), participants_limit,
 *   start_date / end_date in Y-m-d, branch_id + company_id + game_id REQUIRED.
 */
export interface ITournamentApi {
  id: number;
  branch_id: number;
  company_id: number;
  game_id: number;
  title: string;
  description: string;
  tournament_logo_path?: string | null;
  tournament_video_path?: string | null;
  price: number;
  participants_limit: number;
  registered_participants: number;
  start_date: string; // Y-m-d
  end_date?: string | null;
  created_at?: string;
  game?: { id: number; name: string; platform: string };
}

export interface CreateTournamentBody {
  branch_id: number;
  company_id: number;
  game_id: number;
  title: string;
  description: string;
  price: number;
  participants_limit?: number;
  start_date: string; // Y-m-d
  end_date?: string;  // Y-m-d
}

export type UpdateTournamentBody = Partial<Omit<CreateTournamentBody, "branch_id" | "company_id">>;

export const apiListTournaments = (params: { branch_id?: number; company_id?: number; game_id?: number } = {}) =>
  request<PaginatedList<ITournamentApi>>("/tournaments", { params });

export const apiGetTournament = (id: number) =>
  request<{ tournament: ITournamentApi }>(`/tournaments/${id}`);

export const apiCreateTournament = (body: CreateTournamentBody) =>
  request<{ tournament: ITournamentApi }>("/tournaments", { method: "POST", body });

export const apiUpdateTournament = (id: number, body: UpdateTournamentBody) =>
  request<{ tournament: ITournamentApi }>(`/tournaments/${id}?_method=PUT`, { method: "POST", body });

export const apiDeleteTournament = (id: number) =>
  request<{ message: string }>(`/tournaments/${id}`, { method: "DELETE" });
