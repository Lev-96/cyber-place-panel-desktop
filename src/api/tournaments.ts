import { PaginatedList } from "@/types/api";
import { request } from "./client";

/**
 * Mirrors the backend `App\Enums\TournamentSkillLevel` cases. Kept
 * as a literal union (not an `enum`) so the JSON payload uses the
 * same strings the backend stores and validates against, with no
 * runtime mapping layer.
 */
export type SkillLevel = "any" | "beginner" | "intermediate" | "professional";

/** Single source of truth for the picker order (UI use). */
export const SKILL_LEVELS: readonly SkillLevel[] = [
  "any",
  "beginner",
  "intermediate",
  "professional",
] as const;

/**
 * Wire schema (matches backend `tournaments` table + StoreRequest):
 *   title, description (REQUIRED), price (REQUIRED), participants_limit,
 *   start_date / end_date in Y-m-d, branch_id + company_id + game_id REQUIRED.
 *   skill_level defaults to "any" on the backend if omitted.
 */
export interface ITournamentApi {
  id: number;
  branch_id: number;
  company_id: number;
  game_id: number;
  /**
   * Backwards-compatible: rows created before the 2026-05-24
   * migration may serialise this as null until the model is touched.
   * UI code must treat null/undefined the same as "any".
   */
  skill_level?: SkillLevel | null;
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
  skill_level?: SkillLevel;
  title: string;
  description: string;
  price: number;
  participants_limit?: number;
  start_date: string; // Y-m-d
  end_date?: string;  // Y-m-d
}

export type UpdateTournamentBody = Partial<Omit<CreateTournamentBody, "branch_id" | "company_id">>;

export const apiListTournaments = (params: { branch_id?: number; company_id?: number; game_id?: number; per_page?: number; page?: number } = {}) =>
  request<PaginatedList<ITournamentApi>>("/tournaments", { params });

export const apiGetTournament = (id: number) =>
  request<{ tournament: ITournamentApi }>(`/tournaments/${id}`);

export const apiCreateTournament = (body: CreateTournamentBody) =>
  request<{ tournament: ITournamentApi }>("/tournaments", { method: "POST", body });

export const apiUpdateTournament = (id: number, body: UpdateTournamentBody) =>
  request<{ tournament: ITournamentApi }>(`/tournaments/${id}?_method=PUT`, { method: "POST", body });

export const apiDeleteTournament = (id: number) =>
  request<{ message: string }>(`/tournaments/${id}`, { method: "DELETE" });
