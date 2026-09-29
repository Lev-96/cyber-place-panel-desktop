import type { ApiError } from "./client";
import { request } from "./client";
import type {
  ClientAccessStatus, SecurityAuditAction, SessionClient, StaffClient, StaffRole,
} from "@/types/security";

/**
 * The admin's Security section: web / Telegram access of owners and managers,
 * their sessions, blocked IPs, blocked countries and the audit log.
 *
 * Every route sits in the backend's `routes/admin.php` behind the `admin`
 * middleware (no `/api` prefix) — that IS the authorisation boundary; the
 * panel's `menu.security` permission only decides what is drawn. Every write
 * is recorded in the audit log server-side.
 *
 * The types mirror the contract of 2026-09-29 field for field. Change them
 * together with the backend.
 */

/** Pagination meta as `/admin/client-access` and `/admin/security/audit` send it. */
export interface ISecurityPageMetaApi {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface ISecurityPageApi<T> {
  data: T[];
  meta: ISecurityPageMetaApi;
}

/** One client of one staff user: the server's status, never derived here. */
export interface IClientAccessApi {
  status: ClientAccessStatus;
  /** False = this role can never get this client (Telegram for a manager). */
  allowed: boolean;
  granted_at: string | null;
  revoked_at: string | null;
}

export interface IStaffAccessCompanyApi {
  id: number;
  name: string;
}

export interface IStaffAccessBranchApi {
  id: number;
  address: string;
  company_id: number;
}

/** A row of `GET /admin/client-access`. */
export interface IStaffAccessApi {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  companies: IStaffAccessCompanyApi[];
  branches: IStaffAccessBranchApi[];
  clients: Record<StaffClient, IClientAccessApi>;
  telegram_username: string | null;
  /** How many live sessions (tokens) the user holds, every client counted. */
  sessions: number;
}

export interface ListClientAccessParams {
  search?: string;
  role?: StaffRole;
  company_id?: number;
  branch_id?: number;
  /** Used together with `status`. */
  client?: StaffClient;
  status?: ClientAccessStatus;
  page?: number;
}

/** A row of `GET /admin/staff/{user}/sessions`. */
export interface IStaffSessionApi {
  id: number;
  client: SessionClient;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  last_ip: string | null;
  user_agent: string | null;
}

/** Who created a rule, when the server still knows. */
export interface ISecurityActorApi {
  id: number;
  name: string;
}

/** A row of `GET /admin/ip-address`. */
export interface IBlockedIpApi {
  id: number;
  /** IPv4, IPv6 or a CIDR range. */
  ip_address: string;
  note: string | null;
  created_by: ISecurityActorApi | null;
  created_at: string;
}

export interface IBlockedIpListApi {
  data: IBlockedIpApi[];
  /** The address the server sees this request coming from. */
  your_ip: string;
}

export interface CreateBlockedIpBody {
  ip_address: string;
  note?: string;
}

/** A row of `GET /admin/security/countries`. */
export interface IBlockedCountryApi {
  id: number;
  /** ISO 3166-1 alpha-2. */
  country_code: string;
  note: string | null;
  created_by: ISecurityActorApi | null;
  created_at: string;
}

export interface IGeoIpStateApi {
  /** False = rules are saved but NOT enforced (the backend fails open). */
  available: boolean;
  updated_at: string | null;
}

export interface IBlockedCountryListApi {
  data: IBlockedCountryApi[];
  your_country: string | null;
  geoip: IGeoIpStateApi;
  /** Every code the server accepts, ISO 3166-1 alpha-2. */
  codes: string[];
}

export interface CreateBlockedCountryBody {
  country_code: string;
  note?: string;
}

export interface ISecurityAuditSubjectApi {
  type: "user" | "ip" | "country" | "session";
  id: number;
  label: string;
}

/** A row of `GET /admin/security/audit`. */
export interface ISecurityAuditEntryApi {
  id: number;
  /** A {@link SecurityAuditAction}, or one a newer backend added. */
  action: SecurityAuditAction | string;
  actor: ISecurityActorApi | null;
  subject: ISecurityAuditSubjectApi | null;
  /** Free-form context; the contract does not pin its keys. */
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface ListAuditParams {
  action?: SecurityAuditAction;
  actor_id?: number;
  page?: number;
}

export interface IMessageApi {
  message: string;
}

export const apiListClientAccess = (params: ListClientAccessParams = {}) =>
  request<ISecurityPageApi<IStaffAccessApi>>("/admin/client-access", { params });

export const apiGrantClientAccess = (userId: number, client: StaffClient) =>
  request<IMessageApi>(`/admin/staff/${userId}/client-access/${client}`, { method: "PUT" });

export const apiRevokeClientAccess = (userId: number, client: StaffClient) =>
  request<IMessageApi>(`/admin/staff/${userId}/client-access/${client}`, { method: "DELETE" });

export const apiListStaffSessions = (userId: number) =>
  request<{ data: IStaffSessionApi[] }>(`/admin/staff/${userId}/sessions`);

export const apiRevokeStaffSession = (userId: number, tokenId: number) =>
  request<IMessageApi>(`/admin/staff/${userId}/sessions/${tokenId}`, { method: "DELETE" });

export const apiRevokeAllStaffSessions = (userId: number) =>
  request<IMessageApi & { revoked: number }>(`/admin/staff/${userId}/sessions`, { method: "DELETE" });

export const apiListBlockedIps = () => request<IBlockedIpListApi>("/admin/ip-address");

/**
 * 201 with the new row. Whether it arrives bare or wrapped in `data` is not
 * pinned by the contract, so nothing reads it: the screen re-reads the list,
 * which is also what shows the row exactly as the server stored it.
 */
export const apiCreateBlockedIp = (body: CreateBlockedIpBody) =>
  request<unknown>("/admin/ip-address", { method: "POST", body });

export const apiDeleteBlockedIp = (id: number) =>
  request<IMessageApi>(`/admin/ip-address/${id}`, { method: "DELETE" });

export const apiListBlockedCountries = () => request<IBlockedCountryListApi>("/admin/security/countries");

/** 201 with the new row; not read, for the same reason as {@link apiCreateBlockedIp}. */
export const apiCreateBlockedCountry = (body: CreateBlockedCountryBody) =>
  request<unknown>("/admin/security/countries", { method: "POST", body });

export const apiDeleteBlockedCountry = (id: number) =>
  request<IMessageApi>(`/admin/security/countries/${id}`, { method: "DELETE" });

export const apiListSecurityAudit = (params: ListAuditParams = {}) =>
  request<ISecurityPageApi<ISecurityAuditEntryApi>>("/admin/security/audit", { params });

/**
 * The sentence a refused write should show under its field: the first
 * `errors[field]` message of a 422, else the server's `message`, else null
 * (not a validation refusal — the caller falls back to its own copy).
 */
export const validationMessageOf = (error: unknown, field: string): string | null => {
  const err = error as ApiError | undefined;
  if (err?.status !== 422) return null;
  const body = err.body;
  if (!body || typeof body !== "object") return null;
  const { errors, message } = body as { errors?: Record<string, unknown>; message?: unknown };
  const forField = errors?.[field];
  if (Array.isArray(forField) && typeof forField[0] === "string") return forField[0];
  return typeof message === "string" ? message : null;
};
