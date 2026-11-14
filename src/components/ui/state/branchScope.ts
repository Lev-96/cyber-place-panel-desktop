import { createContext } from "react";

/**
 * Whether the screen on display belongs to ONE branch (`/branches/:id/…`).
 *
 * A 403 there means "this branch is not yours" (StaffBranchScope: a manager
 * on another branch's link), and `ErrorState` says exactly that, with no
 * Retry (B11, 2026-11-14). Anywhere else a 403 keeps the generic failure it
 * always had: "not this branch" would be the wrong sentence on, say, the
 * account switcher. Provided by `Layout` from the route; false by default, so
 * a component rendered on its own (tests, dialogs) behaves as before.
 */
export const BranchScopeContext = createContext(false);
