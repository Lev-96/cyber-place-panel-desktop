import type {
  ClientAccessStatus, SecurityAuditAction, SessionClient, StaffRole,
} from "@/types/security";

/**
 * Dictionary keys for every closed set of the Security section, one table per
 * set (`satisfies Record<…>`), so adding a case to a type fails the build until
 * it has words. Keys read as `t(MAP[x])` are invisible to the dictionary's
 * literal-key scan, so `securityLabels.test.ts` checks every one of them.
 */

export const CLIENT_LABEL_KEY = {
  desktop: "security.client.desktop",
  owner_web: "security.client.owner_web",
  telegram: "security.client.telegram",
} as const satisfies Record<SessionClient, string>;

export const ROLE_LABEL_KEY = {
  company_owner: "role.company_owner",
  manager: "role.manager",
} as const satisfies Record<StaffRole, string>;

/** The badge per status: its words and the existing `.pill` variant it wears. */
export const STATUS_LOOK = {
  not_granted: { key: "security.status.not_granted", pill: "is-muted" },
  active: { key: "security.status.active", pill: "confirmed" },
  pending: { key: "security.status.pending", pill: "pending" },
  revoked: { key: "security.status.revoked", pill: "cancelled" },
} as const satisfies Record<ClientAccessStatus, { key: string; pill: string }>;

export const AUDIT_ACTION_LABEL_KEY = {
  "client_access.granted": "security.audit.action.client_access.granted",
  "client_access.revoked": "security.audit.action.client_access.revoked",
  "session.revoked": "security.audit.action.session.revoked",
  "sessions.revoked_all": "security.audit.action.sessions.revoked_all",
  "ip.blocked": "security.audit.action.ip.blocked",
  "ip.unblocked": "security.audit.action.ip.unblocked",
  "country.blocked": "security.audit.action.country.blocked",
  "country.unblocked": "security.audit.action.country.unblocked",
} as const satisfies Record<SecurityAuditAction, string>;
