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
  mode?: "fixed" | "open";
  hourly_rate?: number | string | null;
  started_at: string;   // ISO
  ends_at: string | null;      // ISO; null for open (count-up) sessions
  status: "active" | "stopped" | "expired";
  total_paid: number;
  items?: Array<{ id: number; name: string; price: number | string; qty: number; product_id: number | null }>;
}

export interface IPcApi {
  id: number;
  branch_id: number;
  place_id?: number | null;
  label: string;
  kind?: "pc" | "ps";
  hourly_rate?: number | string | null;
  mac_address?: string | null;
  status: "online" | "offline" | "in_session";
  last_seen_at?: string | null;
  pairing_token?: string; // present only on create / rotate-token responses
  current_session_id?: number;
}
