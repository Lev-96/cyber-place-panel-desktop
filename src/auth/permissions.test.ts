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

    it("can open the Metrics section", () => {
      expect(can("admin", "menu.metrics")).toBe(true);
    });
  });

  // Website analytics and server health are network-wide data — a single
  // company's owner (let alone a branch manager) must never see them. The
  // backend enforces the same on the `admin` guard; this pins the UI half so
  // the section cannot be widened by accident.
  describe("menu.metrics is admin-only", () => {
    it("is denied to owner and manager", () => {
      expect(can("company_owner", "menu.metrics")).toBe(false);
      expect(can("manager", "menu.metrics")).toBe(false);
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
    });

    it("can configure prices and edit branches", () => {
      expect(can("company_owner", "branch.prices")).toBe(true);
      expect(can("company_owner", "branch.edit")).toBe(true);
    });

    it("builds its branches' game libraries but not the shared catalogue", () => {
      expect(can("company_owner", "game.crud.branch")).toBe(true);
      expect(can("company_owner", "game.crud")).toBe(false);
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

    it("cannot edit the branch profile (logo/info) or prices — owner/admin only", () => {
      expect(can("manager", "branch.edit")).toBe(false);
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

    // A manager registers the places they run — including custom-platform
    // ones — so they must be able to add that platform's games to THEIR
    // branch. The shared catalogue stays out of reach (backend agrees).
    it("can add games to their own branch but not touch the shared catalogue", () => {
      expect(can("manager", "game.crud.branch")).toBe(true);
      expect(can("manager", "game.crud")).toBe(false);
      expect(can("manager", "menu.games")).toBe(false);
    });

    it("can scan codes and see tournaments", () => {
      expect(can("manager", "menu.scan")).toBe(true);
      expect(can("manager", "menu.tournaments")).toBe(true);
    });
  });
});
