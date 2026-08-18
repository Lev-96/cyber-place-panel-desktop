import { describe, expect, it } from "vitest";
import { resolveBookingScopeChannel } from "./bookingScope";
import type { AuthUser } from "@/types/api";

const user = (role: string, dashboard: Record<string, unknown> = {}): AuthUser =>
  ({ id: 1, name: "u", email: "u@t.test", role, dashboard } as unknown as AuthUser);

describe("resolveBookingScopeChannel", () => {
  it("gives an admin the platform-wide feed, privately", () => {
    expect(resolveBookingScopeChannel(user("admin"))).toEqual({
      name: "bookings.global",
      isPrivate: true,
    });
  });

  it("gives an owner their own company, privately", () => {
    expect(resolveBookingScopeChannel(user("company_owner", { company_id: 3 }))).toEqual({
      name: "company.3",
      isPrivate: true,
    });
  });

  it("gives a manager their branch, privately", () => {
    // The staff payload names the guest, so it travels privately for every
    // role. The mobile app keeps reading the PUBLIC branch.{id}, where a
    // separate person-free event carries the same `booking.changed` alias.
    //
    // If this ever flips back to false the manager keeps receiving something —
    // the public signal — and simply shows toasts with no guest name and no
    // booking code. Working, wrong, and silent: hence the assertion.
    expect(resolveBookingScopeChannel(user("manager", { branch_id: 7 }))).toEqual({
      name: "branch.7",
      isPrivate: true,
    });
  });

  it("refuses to subscribe orphan staff rather than falling back to the global feed", () => {
    // The fallback is what produced cross-tenant toasts for a manager once.
    expect(resolveBookingScopeChannel(user("company_owner"))).toBeNull();
    expect(resolveBookingScopeChannel(user("manager"))).toBeNull();
  });

  it("refuses an unknown role and a missing user", () => {
    expect(resolveBookingScopeChannel(user("cashier"))).toBeNull();
    expect(resolveBookingScopeChannel(null)).toBeNull();
    expect(resolveBookingScopeChannel(undefined)).toBeNull();
  });
});
