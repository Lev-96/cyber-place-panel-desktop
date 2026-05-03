import { request } from "./client";

export interface ITournamentRegistration {
  id: number;
  tournament_id: number;
  guest_id: number;
  /** "player" takes a counted spot; "guest" is a spectator slot. */
  as?: "player" | "guest";
  /**
   * Backend ships first_name + last_name when the player went
   * through the split-name modal, plus the legacy `name` for
   * single-name registrations / older data.
   */
  guest?: {
    id: number;
    name: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string;
  };
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
