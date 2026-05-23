import { request } from "./client";

export interface ITournamentRegistration {
  id: number;
  tournament_id: number;
  guest_id: number;
  /** "player" takes a counted spot; "guest" is a spectator slot. */
  as?: "player" | "guest";
  /**
   * When the player has been verified on-site by staff, the backend
   * fills this ISO-8601 timestamp. null/undefined = pending.
   *
   * `verifier` carries the staff actor for the audit trail (shown
   * as "verified by Alice" next to the ✓ badge).
   *
   * NOTE: the backend's `StaffRegistrationResource` deliberately
   * does NOT expose `join_code` here — codes are for players to
   * present, never for staff to look up. Do not add it to this
   * type, even speculatively, or staff could mark anyone verified
   * without the player being on-site.
   */
  verified_at?: string | null;
  verifier?: { id: number; name: string } | null;
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

/** Shape of the `verify` endpoint response. Subset of ITournamentRegistration — never includes `join_code`. */
export interface VerifyResult {
  id: number;
  tournament_id: number;
  verified_at: string;
  verifier?: { id: number; name: string } | null;
  guest?: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export const apiListTournamentRegistrations = (params: { tournament_id?: number } = {}) =>
  request<{ data: ITournamentRegistration[] }>("/tournament-registration", { params });

export const apiCreateTournamentRegistration = (body: CreateRegistrationBody) =>
  request<{ registration: ITournamentRegistration }>("/tournament-registration", { method: "POST", body });

export const apiDeleteTournamentRegistration = (id: number) =>
  request<{ message: string }>(`/tournament-registration/${id}`, { method: "DELETE" });

/**
 * Staff-facing: mark a player verified by the join code they show
 * on arrival. Backend trims + uppercases the code, so the desktop
 * can pass whatever the staff typed (or whatever the QR scanner
 * decoded) untouched.
 *
 * Errors surface as HTTP status codes from the request helper:
 *   404 → code not found (or wrong tournament)
 *   409 → registration was already verified
 *   400 → staff user has no role on this tournament's branch
 */
export const apiVerifyRegistrationCode = (body: { tournament_id: number; code: string }) =>
  request<{ message: string; data: VerifyResult }>("/tournament-registration/verify", {
    method: "POST",
    body,
  });
