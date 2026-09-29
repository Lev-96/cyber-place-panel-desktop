/**
 * The closed sets of the admin Security section, mirrored from the backend
 * contract (2026-09-29). Components compare against these, never against a
 * bare "owner_web" / "active" (CLAUDE.md §4, `src/types/pc.ts` is the model).
 */

/** The two staff roles the access list covers. Admins are not in it. */
export type StaffRole = "company_owner" | "manager";

export const STAFF_ROLE = {
  Owner: "company_owner",
  Manager: "manager",
} as const satisfies Record<string, StaffRole>;

export const STAFF_ROLES: readonly StaffRole[] = [STAFF_ROLE.Owner, STAFF_ROLE.Manager];

/** A client an admin grants or revokes: the owner web app and the Telegram bot. */
export type StaffClient = "owner_web" | "telegram";

export const STAFF_CLIENT = {
  OwnerWeb: "owner_web",
  Telegram: "telegram",
} as const satisfies Record<string, StaffClient>;

/** Column order in the access table. */
export const STAFF_CLIENTS: readonly StaffClient[] = [STAFF_CLIENT.OwnerWeb, STAFF_CLIENT.Telegram];

/** Where a session (token) was issued. `desktop` is this panel and is never granted — it is the default. */
export type SessionClient = "desktop" | StaffClient;

export const SESSION_CLIENT = {
  Desktop: "desktop",
  OwnerWeb: "owner_web",
  Telegram: "telegram",
} as const satisfies Record<string, SessionClient>;

/**
 * The server's status of one client for one user. `pending` = Telegram was
 * granted but the person has not confirmed the link in the bot yet.
 */
export type ClientAccessStatus = "not_granted" | "active" | "revoked" | "pending";

export const CLIENT_ACCESS_STATUS = {
  NotGranted: "not_granted",
  Active: "active",
  Revoked: "revoked",
  Pending: "pending",
} as const satisfies Record<string, ClientAccessStatus>;

export const CLIENT_ACCESS_STATUSES: readonly ClientAccessStatus[] = [
  CLIENT_ACCESS_STATUS.NotGranted,
  CLIENT_ACCESS_STATUS.Active,
  CLIENT_ACCESS_STATUS.Pending,
  CLIENT_ACCESS_STATUS.Revoked,
];

/** The action behind an access cell's button. */
export type ClientAccessAction = "grant" | "revoke";

/**
 * What an access cell shows and offers, from the server's two fields alone:
 *
 *  - `allowed: false` → nothing to show and nothing to press, whatever the
 *    status says (the role can never get this client);
 *  - granted (`active`, `pending`) → Revoke;
 *  - not granted (`not_granted`, `revoked`) → Grant.
 *
 * The status itself is printed as the server sent it — never recomputed.
 */
export const clientAccessCell = (
  access: { status: ClientAccessStatus; allowed: boolean } | undefined,
): { kind: "unavailable" } | { kind: "status"; status: ClientAccessStatus; action: ClientAccessAction } => {
  if (!access || !access.allowed) return { kind: "unavailable" };
  const granted = access.status === CLIENT_ACCESS_STATUS.Active || access.status === CLIENT_ACCESS_STATUS.Pending;
  return { kind: "status", status: access.status, action: granted ? "revoke" : "grant" };
};

/** Actions the audit log records. */
export type SecurityAuditAction =
  | "client_access.granted"
  | "client_access.revoked"
  | "session.revoked"
  | "sessions.revoked_all"
  | "ip.blocked"
  | "ip.unblocked"
  | "country.blocked"
  | "country.unblocked";

export const SECURITY_AUDIT_ACTIONS: readonly SecurityAuditAction[] = [
  "client_access.granted",
  "client_access.revoked",
  "session.revoked",
  "sessions.revoked_all",
  "ip.blocked",
  "ip.unblocked",
  "country.blocked",
  "country.unblocked",
];

export const isSecurityAuditAction = (value: string): value is SecurityAuditAction =>
  (SECURITY_AUDIT_ACTIONS as readonly string[]).includes(value);

export const isStaffClient = (value: unknown): value is StaffClient =>
  typeof value === "string" && (STAFF_CLIENTS as readonly string[]).includes(value);
