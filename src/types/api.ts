export type PlatformType = "pc" | "ps4" | "ps5";
export type PlaceType = "standard" | "vip";
export type BookingStatusType = "pending" | "confirmed" | "cancelled" | "rescheduled";
export type CompanyStatusType = "active" | "pending";
export type Role = "admin" | "company_owner" | "manager";

export interface DashboardSummary {
  total_companies?: number;
  total_branches?: number;
  total_places?: number;
  total_bookings?: number;
  active_branches?: number;
  total_bookings_today?: number;
  upcoming_bookings?: number;
  all_places?: number;
  company_id?: number;
  branch_id?: number | null;
  occupied_places_right_now?: string; // "0/0"
}

export interface PaginatedList<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface IGame {
  id: number;
  name: string;
  platform: PlatformType;
}

export interface IBranchService {
  id: number;
  name_en: string;
  name_ru: string;
  name_am: string;
  price?: number | string | null;
  service_logo_path?: string;
}

export interface IBranchPlace {
  id: number;
  branch_id: number;
  type: PlaceType;
  status: "active" | "inactive";
  platform: PlatformType;
  games: IGame[];
}

export interface IBookingApi {
  id: number;
  company_id: number;
  branch_id: number;
  game_id: number;
  guest_id: number;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  rescheduled_minutes?: number;
  end_time: string;
  status: BookingStatusType;
  code: number;
  place_booking_count: number;
  company?: { id: number; name: string };
  game?: { id: number; platform: PlatformType; name: string };
}

export interface IBranchApi {
  id: number;
  company_id: number;
  city: string;
  country: string;
  address: string;
  address_lat?: number | string | null;
  address_lng?: number | string | null;
  phone: string | string[] | null;
  branch_logo_path: string;
  status: string;
  places_count?: number;
  managers_count?: number;
  service_count: number;
  ratings_avg_rating: number | null;
  price_for_branch?: {
    id: number;
    branch_id: number;
    "pc-standard": number | null;
    "pc-vip": number | null;
    "ps4-standard": number | null;
    "ps4-vip": number | null;
    "ps5-standard": number | null;
    "ps5-vip": number | null;
  };
  company?: { id: number; name: string };
}

export interface ICompanyApi {
  id: number;
  user_id: number;
  user?: { id: number; name: string; email: string };
  name: string;
  email: string;
  phone: string;
  company_logo_path: string;
  company_country: string;
  company_city: string;
  tin: string;
  website: string;
  description: string;
  status: CompanyStatusType;
  branches_count?: number;
  managers_count?: number;
  commission_percent?: number | string | null;
  last_paid_at?: string | null;
  next_due_at?: string | null;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  dashboard?: DashboardSummary;
}
