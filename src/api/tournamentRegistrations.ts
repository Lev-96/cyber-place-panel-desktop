import { request } from "./client";

export interface ITournamentRegistration {
  id: number;
  tournament_id: number;
  guest_id: number;
  /** "player" takes a counted spot; "guest" is a spectator slot. */
  as?: "player" | "guest";
  /**
   * Player identity captured by the mobile WelcomeNameGate. The
   * backend's guests row only stores split first / last now, so
   * the response shape mirrors that.
   */
  guest?: {
    id: number;
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
