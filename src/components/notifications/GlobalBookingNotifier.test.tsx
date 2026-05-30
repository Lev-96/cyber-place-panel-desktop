import { describe, expect, test } from "vitest";
import { shouldShowBookingToasts } from "./GlobalBookingNotifier";
import type { AuthUser } from "@/types/api";

/**
 * Regression-shield for the role gate that suppresses the
 * corner-popup booking toasts for non-manager roles. Wiring the
 * full component (Reverb subscriptions + AuthContext + i18n
 * provider chain) under jsdom adds plumbing for no extra coverage,
 * so we lock the single source of truth — `shouldShowBookingToasts`
 * — directly.
 *
 * Anyone re-introducing admin / owner to the toast surface (or a
 * broader `role !== 'guest'` rule) will trip these cases before it
 * leaks into production.
 */
const u = (role: string | undefined): AuthUser =>
  ({ id: 1, role, name: "x", email: "x" } as unknown as AuthUser);

describe("shouldShowBookingToasts", () => {
  test("manager sees toasts", () => {
    expect(shouldShowBookingToasts(u("manager"))).toBe(true);
  });
  test("admin does NOT see toasts", () => {
    expect(shouldShowBookingToasts(u("admin"))).toBe(false);
  });
  test("company_owner does NOT see toasts", () => {
    expect(shouldShowBookingToasts(u("company_owner"))).toBe(false);
  });
  test("null user does NOT see toasts", () => {
    expect(shouldShowBookingToasts(null)).toBe(false);
  });
  test("unknown role does NOT see toasts", () => {
    expect(shouldShowBookingToasts(u("guest"))).toBe(false);
  });
});
