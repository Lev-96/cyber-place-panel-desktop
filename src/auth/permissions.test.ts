import { describe, expect, it } from "vitest";
import { can } from "./permissions";

// Pin the permission contract for each role. If someone accidentally
// strips `branch.edit` from manager or `revenue.view` from owner, the
// tests fail and the regression is caught before login.

describe("can(role, perm)", () => {
  it("returns false for an undefined or null role", () => {
    expect(can(undefined, "menu.branches")).toBe(false);
    expect(can(null, "menu.branches")).toBe(false);
  });

  describe("admin", () => {
    it("can see global menus", () => {
      expect(can("admin", "menu.branches")).toBe(true);
      expect(can("admin", "menu.companies")).toBe(true);
      expect(can("admin", "menu.managers")).toBe(true);
      expect(can("admin", "menu.games")).toBe(true);
      expect(can("admin", "menu.servicesAdmin")).toBe(true);
    });

    it("can manage branches and companies", () => {
      expect(can("admin", "branch.create")).toBe(true);
      expect(can("admin", "branch.edit")).toBe(true);
      expect(can("admin", "branch.delete")).toBe(true);
      expect(can("admin", "branch.prices")).toBe(true);
      expect(can("admin", "company.create")).toBe(true);
      expect(can("admin", "company.delete")).toBe(true);
    });

    it("can view revenue (admin + owner only perm)", () => {
      expect(can("admin", "revenue.view")).toBe(true);
    });
  });

  describe("company_owner", () => {
    it("can see branches list and the my-company shortcut", () => {
      expect(can("company_owner", "menu.branches")).toBe(true);
      expect(can("company_owner", "menu.myCompany")).toBe(true);
    });

    it("cannot see the global companies list (admin-only)", () => {
      expect(can("company_owner", "menu.companies")).toBe(false);
      expect(can("company_owner", "menu.games")).toBe(false);
      expect(can("company_owner", "menu.servicesAdmin")).toBe(false);
    });

    it("can configure prices and edit branches", () => {
      expect(can("company_owner", "branch.prices")).toBe(true);
      expect(can("company_owner", "branch.edit")).toBe(true);
    });

    it("can view revenue", () => {
      expect(can("company_owner", "revenue.view")).toBe(true);
    });

    it("cannot create or delete companies", () => {
      expect(can("company_owner", "company.create")).toBe(false);
      expect(can("company_owner", "company.delete")).toBe(false);
    });
  });

  describe("manager", () => {
    it("can do operational work (sessions, POS, shift)", () => {
      expect(can("manager", "session.start")).toBe(true);
      expect(can("manager", "session.stop")).toBe(true);
      expect(can("manager", "pos.charge")).toBe(true);
      expect(can("manager", "shift.open")).toBe(true);
    });

    it("can edit own-branch info but NOT prices (owner-only business decision)", () => {
      expect(can("manager", "branch.edit")).toBe(true);
      expect(can("manager", "branch.prices")).toBe(false);
    });

    it("cannot manage other managers or see global lists", () => {
      expect(can("manager", "manager.create")).toBe(false);
      expect(can("manager", "manager.delete")).toBe(false);
      expect(can("manager", "menu.branches")).toBe(false);
      expect(can("manager", "menu.companies")).toBe(false);
      expect(can("manager", "menu.managers")).toBe(false);
    });

    it("cannot view revenue", () => {
      expect(can("manager", "revenue.view")).toBe(false);
    });

    it("can scan codes and see tournaments", () => {
      expect(can("manager", "menu.scan")).toBe(true);
      expect(can("manager", "menu.tournaments")).toBe(true);
    });
  });
});
