import type { CompanyStatusType, PaginatedList } from "@/types/api";
import type { BranchStatus } from "@/types/branch";
import type { ApiError } from "./client";
import { request } from "./client";

/**
 * The admin's Owners section — `routes/admin.php` → `Admin\OwnerController`.
 *
 * Every endpoint sits under `/admin/*`, behind the backend's `admin` middleware:
 * that IS the authorisation boundary, so a non-admin build calling these gets a
 * 403 whatever the UI draws. `{owner}` resolves only a `company_owner` — an
 * admin's or a manager's id is a 404 on every verb.
 *
 * The types below mirror the Laravel Resources field for field
 * (`App\Http\Resources\Admin\Owners\*`). Change them together.
 */

/** One of the owner's companies, as `OwnerResource.companies[]` renders it. */
export interface IOwnerCompanyApi {
  id: number;
  name: string;
  status: CompanyStatusType;
  /** Effective block (`Company::isBlocked()`). */
  is_blocked: boolean;
  branches_count: number;
  managers_count: number;
}

/** `OwnerResource` — the list row, and the base of the single read. */
export interface IOwnerApi {
  id: number;
  name: string;
  email: string;
  /** ISO-8601, or null for a row with no timestamp. */
  created_at: string | null;
  /**
   * `whenLoaded('companies')` on the Resource. Every Owners endpoint loads it
   * today (`OwnerRelations::companies()`); typed optional because the Resource
   * is allowed to omit it, and a row without it must still render.
   */
  companies?: IOwnerCompanyApi[];
}

/**
 * Why a delete cannot run yet — `App\Enums\TenantDeletionBlocker`. The panel
 * words each one itself; anything newer falls back to the server's `message`.
 */
export type TenantDeletionBlockerCode = "running_sessions" | "upcoming_bookings";

export const TENANT_DELETION_BLOCKER = {
  RunningSessions: "running_sessions",
  UpcomingBookings: "upcoming_bookings",
} as const satisfies Record<string, TenantDeletionBlockerCode>;

/** `DeletionPreview::blockerList()` — the same shape in the preview and in the 409. */
export interface ITenantDeletionBlockerApi {
  /** A {@link TenantDeletionBlockerCode}, or a code a newer backend added. */
  code: string;
  count: number;
  /** The server's sentence, in the language the request negotiated. */
  message: string;
}

/** `DeletionPreviewResource` — what the delete would take with it, and whether it may run. */
export interface IOwnerDeletionPreviewApi {
  companies: number;
  branches: number;
  managers: number;
  places: number;
  sessions_total_count: number;
  running_sessions: number;
  upcoming_bookings: number;
  members_with_balance: number;
  can_delete: boolean;
  blockers: ITenantDeletionBlockerApi[];
}

/**
 * A branch of one of the owner's companies — `companies[].branches[]`, single
 * read only. Nullable exactly where `OwnerResource::branch()` declares it
 * (`?string`): the page falls back to `№{id}` / "-" and reads a null status
 * as active, the same rule as an absent one.
 */
export interface IOwnerBranchApi {
  id: number;
  address: string | null;
  city: string | null;
  status: BranchStatus | null;
  /** Effective block: the branch's own or its company's (`Branch::isEffectivelyBlocked()`). */
  is_blocked: boolean;
}

/** A company on the single read: the list row's fields plus its branches. */
export interface IOwnerDetailCompanyApi extends IOwnerCompanyApi {
  /**
   * Present only on `GET /admin/owners/{id}` (the list does not pay for it).
   * Optional because a backend that predates it omits the key — the page then
   * shows the counts alone. An empty array means the company has no branches.
   */
  branches?: IOwnerBranchApi[];
}

/** `GET /admin/owners/{id}` — the owner, their companies' branches and the deletion preview (only here). */
export interface IOwnerDetailApi extends IOwnerApi {
  companies?: IOwnerDetailCompanyApi[];
  deletion: IOwnerDeletionPreviewApi;
}

/** `OwnerDeletionResource` — what a committed delete removed. */
export interface IOwnerDeletionResultApi {
  owner_id: number;
  company_ids: number[];
  /** Count of branches removed. */
  branches: number;
  /** Count of user accounts removed (the owner and the managers who worked only there). */
  deleted_users: number;
  /** Rows deleted per table, in deletion order. */
  rows: Record<string, number>;
}

export interface ListOwnersParams {
  /** Matched against name, email and company names. Max 255 chars server-side. */
  search?: string;
  page?: number;
  /** 1–100 (capped server-side). */
  per_page?: number;
}

/** `PUT /admin/owners/{id}` — both required; email unique ignoring this owner. */
export interface UpdateOwnerBody {
  name: string;
  email: string;
}

/** The 409 the delete answers with while live work remains (`TenantDeletionBlockedException`). */
export interface DeletionBlockedBody {
  message: string;
  code: "deletion_blocked";
  blockers: ITenantDeletionBlockerApi[];
}

export const DELETION_BLOCKED_CODE = "deletion_blocked";

const base = "/admin/owners";

export const apiListOwners = (params: ListOwnersParams = {}) =>
  request<PaginatedList<IOwnerApi>>(base, { params });

export const apiGetOwner = (id: number) =>
  request<{ data: IOwnerDetailApi }>(`${base}/${id}`);

export const apiUpdateOwner = (id: number, body: UpdateOwnerBody) =>
  request<{ data: IOwnerApi; message?: string }>(`${base}/${id}`, { method: "PUT", body });

export const apiDeleteOwner = (id: number) =>
  request<{ data: IOwnerDeletionResultApi; message?: string }>(`${base}/${id}`, { method: "DELETE" });

/**
 * The blockers of a delete the server refused with 409, or null when it failed
 * for any other reason. Shaped after `blockedBodyOf` / `seatUnavailableBodyOf`:
 * read the code, never the sentence.
 */
export const deletionBlockersOf = (error: unknown): ITenantDeletionBlockerApi[] | null => {
  const err = error as ApiError | undefined;
  const body = err?.body;
  if (err?.status !== 409 || !body || typeof body !== "object") return null;

  const candidate = body as Partial<DeletionBlockedBody>;
  return candidate.code === DELETION_BLOCKED_CODE && Array.isArray(candidate.blockers)
    ? candidate.blockers
    : null;
};
