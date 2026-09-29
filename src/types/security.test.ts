import { describe, expect, test } from "vitest";
import { clientAccessCell, isSecurityAuditAction, SECURITY_AUDIT_ACTIONS } from "./security";

/**
 * What an access cell shows and offers. The status is the server's and is
 * printed as sent; the only decision here is which button goes with it, and
 * that `allowed: false` beats any status.
 */
describe("clientAccessCell", () => {
  test.each([
    ["active", "revoke"],
    ["pending", "revoke"],
    ["not_granted", "grant"],
    ["revoked", "grant"],
  ] as const)("%s → %s, status passed through", (status, action) => {
    expect(clientAccessCell({ status, allowed: true })).toEqual({ kind: "status", status, action });
  });

  test.each(["active", "pending", "not_granted", "revoked"] as const)(
    "allowed=false is unavailable whatever the status (%s)",
    (status) => {
      expect(clientAccessCell({ status, allowed: false })).toEqual({ kind: "unavailable" });
    },
  );

  test("a client missing from the payload is unavailable, not an error", () => {
    expect(clientAccessCell(undefined)).toEqual({ kind: "unavailable" });
  });
});

describe("audit actions", () => {
  test("the eight contract actions are known, anything else is not", () => {
    expect(SECURITY_AUDIT_ACTIONS).toHaveLength(8);
    for (const a of SECURITY_AUDIT_ACTIONS) expect(isSecurityAuditAction(a)).toBe(true);
    expect(isSecurityAuditAction("user.deleted")).toBe(false);
  });
});
