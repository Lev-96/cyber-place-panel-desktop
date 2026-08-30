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

    it("can block a company or a branch", () => {
      expect(can("admin", "company.block")).toBe(true);
      expect(can("admin", "branch.block")).toBe(true);
    });
  });

  /**
   * The block is used AGAINST a company — an unpaid invoice, abuse, a venue
   * that must stop trading today. Its own owner lifting it would defeat the
   * point, and a manager doing so would be worse. Editing rights must never
   * imply blocking rights; the backend refuses these calls on the `admin`
   * guard, and this pins the button that leads to them.
   */
  describe("blocking is admin-only", () => {
    it("is denied to an owner, who may still edit the very same company", () => {
      expect(can("company_owner", "company.edit")).toBe(true);
      expect(can("company_owner", "company.block")).toBe(false);
      expect(can("company_owner", "branch.edit")).toBe(true);
      expect(can("company_owner", "branch.block")).toBe(false);
    });

    it("is denied to a manager", () => {
      expect(can("manager", "company.block")).toBe(false);
      expect(can("manager", "branch.block")).toBe(false);
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
    // `shift.open` left this list on 2026-08-30 — the cashier shift is the
    // company's cash record, and the section went with it. A sale does not
    // need one: `orders.cashier_shift_id` is nullable, so the POS still works.
    it("can do operational work (sessions, POS)", () => {
      expect(can("manager", "session.start")).toBe(true);
      expect(can("manager", "session.stop")).toBe(true);
      expect(can("manager", "pos.charge")).toBe(true);
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

    // 2026-08-30: a manager works inside the arrangement, they do not make it.
    // Seats, shifts, member cards and the product catalogue left the role;
    // running the floor did not. The backend refuses the same four sections
    // (`App\Services\Access\StaffCapability`), so this is the button half of
    // one rule — see tests/Feature/StaffSectionAccessTest.php.
    it("does not arrange the branch: no seats, shifts, member cards or product writes", () => {
      expect(can("manager", "branch.places")).toBe(false);
      expect(can("manager", "shift.open")).toBe(false);
      expect(can("manager", "branch.members")).toBe(false);
      expect(can("manager", "product.crud")).toBe(false);
    });

    it("still runs the floor", () => {
      expect(can("manager", "session.start")).toBe(true);
      expect(can("manager", "session.stop")).toBe(true);
      expect(can("manager", "pos.charge")).toBe(true);
    });
  });

  // The one rule that narrows an OWNER too: member cards and deposit balances
  // are administrative, so the section is gone from an owner's branch as well.
  describe("member cards", () => {
    it("are admin-only", () => {
      expect(can("admin", "branch.members")).toBe(true);
      expect(can("company_owner", "branch.members")).toBe(false);
      expect(can("manager", "branch.members")).toBe(false);
    });
  });

  describe("owner keeps what a company runs", () => {
    it("arranges seats, shifts and products", () => {
      expect(can("company_owner", "branch.places")).toBe(true);
      expect(can("company_owner", "shift.open")).toBe(true);
      expect(can("company_owner", "product.crud")).toBe(true);
    });

    it("creates managers", () => {
      expect(can("company_owner", "manager.create")).toBe(true);
    });
  });
});
