import { useAuth } from "@/auth/AuthContext";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Resets the router to the dashboard whenever the signed-in ACCOUNT changes
 * (sign-out, sign-in, or one staff member handing the machine to another).
 *
 * The panel runs on a `HashRouter`, so the location survives the auth state
 * flipping — nothing navigates on sign-out. Without this, signing back in
 * re-mounted whatever screen the previous session was left on: the operator
 * landed on a stale branch page instead of the dashboard, and after switching
 * to a DIFFERENT account that page still showed the previous owner's branch
 * until its own fetch replaced it. Both reports (2026-07-21) are the same
 * root cause — a route outliving the account that opened it.
 *
 * Mounted once inside the router, above the authed/unauthed split. Renders
 * nothing. The first observation only records the current account, so a deep
 * link the app was opened with (e.g. `#/reset-password?token=…`) is never
 * stolen.
 */
const AuthRouteReset = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // `undefined` = no account observed yet (first run), `null` = signed out.
  const lastAccountRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const accountId = user?.id ?? null;
    const previous = lastAccountRef.current;
    lastAccountRef.current = accountId;

    if (previous === undefined || previous === accountId) return;
    navigate("/", { replace: true });
  }, [user?.id, navigate]);

  return null;
};

export default AuthRouteReset;
