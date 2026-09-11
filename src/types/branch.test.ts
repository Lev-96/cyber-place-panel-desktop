import { describe, expect, test } from "vitest";
import { BRANCH_STATUS, BRANCH_STATUSES, DEFAULT_BRANCH_STATUS, branchStatusOf, isBranchInactive } from "./branch";

describe("branch status", () => {
  test("only `inactive` hides a branch from players", () => {
    expect(isBranchInactive("inactive")).toBe(true);
    expect(isBranchInactive("active")).toBe(false);
  });

  // A backend that predates the field sends no status. Badging the whole
  // network as hidden on such a backend would be a false alarm everywhere.
  test("an absent status reads as active", () => {
    expect(isBranchInactive(undefined)).toBe(false);
    expect(branchStatusOf(undefined)).toBe(BRANCH_STATUS.Active);
    expect(branchStatusOf("inactive")).toBe(BRANCH_STATUS.Inactive);
  });

  // The backend opens a branch created without a status; the create form
  // starts on the same value so what the owner sees is what they get.
  test("a new branch defaults to active, like the backend", () => {
    expect(DEFAULT_BRANCH_STATUS).toBe("active");
  });

  // Mirrors the backend `App\Enums\BranchStatus` ('active', 'inactive').
  test("the closed set matches the backend enum", () => {
    expect([...BRANCH_STATUSES].sort()).toEqual(["active", "inactive"]);
  });
});
