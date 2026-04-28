import { request } from "./client";

export interface ITournamentRegistration {
  id: number;
  tournament_id: number;
  guest_id: number;
  guest?: { id: number; name: string; phone?: string };
  created_at?: string;
}

export interface CreateRegistrationBody {
  tournament_id: number;
  guest_id: number;
}

export const apiListTournamentRegistrations = (params: { tournament_id?: number } = {}) =>
  request<{ data: ITournamentRegistration[] }>("/tournament-registration", { params });

export const apiCreateTournamentRegistration = (body: CreateRegistrationBody) =>
  request<{ registration: ITournamentRegistration }>("/tournament-registration", { method: "POST", body });

export const apiDeleteTournamentRegistration = (id: number) =>
  request<{ message: string }>(`/tournament-registration/${id}`, { method: "DELETE" });
