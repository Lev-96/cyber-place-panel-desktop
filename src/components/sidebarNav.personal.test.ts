import { describe, expect, test } from "vitest";
import { applyPersonalMenu } from "./sidebarNav";

/**
 * A person's own menu (2026-10-27): reorder and hide what the role already
 * shows — never more, never the required entries, and never at the cost of an
 * entry added later.
 */
describe("applyPersonalMenu", () => {
  const item = (id: string) => ({ id, to: `/${id}`, label: id });
  const role = [item("nav.dashboard"), item("nav.branches"), item("nav.bookings"), item("nav.notifications"), item("nav.settings"), item("nav.appearance")];

  test("nothing arranged: the role's menu as it is", () => {
    expect(applyPersonalMenu(role, [])).toEqual(role);
  });

  test("reorders, keeps home first, and puts entries never arranged after the arranged ones", () => {
    const ids = applyPersonalMenu(role, [
      { id: "nav.bookings", hidden: false }, { id: "nav.settings", hidden: false }, { id: "nav.branches", hidden: false },
    ]).map((i) => i.id);
    expect(ids).toEqual(["nav.dashboard", "nav.bookings", "nav.settings", "nav.branches", "nav.notifications", "nav.appearance"]);
  });

  test("hides what may be hidden, never the required entries", () => {
    const ids = applyPersonalMenu(role, [
      { id: "nav.branches", hidden: true }, { id: "nav.notifications", hidden: true },
      { id: "nav.settings", hidden: true }, { id: "nav.appearance", hidden: true }, { id: "nav.dashboard", hidden: true },
    ]).map((i) => i.id);
    expect(ids).not.toContain("nav.branches");
    for (const required of ["nav.dashboard", "nav.notifications", "nav.settings", "nav.appearance"]) expect(ids).toContain(required);
  });

  test("an arrangement can never add an entry the role does not show", () => {
    const ids = applyPersonalMenu(role, [{ id: "nav.security", hidden: false }, { id: "nav.owners", hidden: false }]).map((i) => i.id);
    expect(ids).not.toContain("nav.security");
    expect(ids).toHaveLength(role.length);
  });
});
