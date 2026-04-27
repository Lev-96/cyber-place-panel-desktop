/**
 * Sessions / time-billing types. The backend Laravel migrations
 * `sessions` and `time_packages` are still pending — until they exist,
 * the cashier UI runs against a local mock implementation that conforms
 * to these shapes. Same shapes will work against the real REST endpoints
 * when they ship.
 */

export interface ITimePackage {
  id: number;
  name: string;
  duration_minutes: number;
  price: number;
}

export interface ISessionApi {
  id: number;
  branch_id: number;
  pc_id: number;
  pc_label: string;
  user_display_name?: string;
  package_id?: number;
  package_name?: string;
  started_at: string;   // ISO
  ends_at: string;      // ISO
  status: "active" | "stopped" | "expired";
  total_paid: number;
}

export interface IPcApi {
  id: number;
  branch_id: number;
  place_id?: number | null;
  label: string;
  mac_address?: string | null;
  status: "online" | "offline" | "in_session";
  last_seen_at?: string | null;
  pairing_token?: string; // present only on create / rotate-token responses
  current_session_id?: number;
}
