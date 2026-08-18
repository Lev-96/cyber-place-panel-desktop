import { useAuth } from "@/auth/AuthContext";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { notify } from "@/ui/notify";
import { useEffect, useRef } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";

/**
 * Keeps staff out of the working screens of a branch that is out of service.
 *
 * Blocking a branch already does two things: it refuses the login of anyone
 * left with no open workplace, and it evicts a panel that is STANDING IN that
 * branch when the block lands ({@link AccessGuard}). Neither covers the case
 * that stays open afterwards — an owner whose other venues are fine, who is
 * therefore still signed in, walking into the closed branch from the branch
 * list and using it as if nothing happened. Sessions, POS, shifts, tariffs: all
 * reachable, all writing to a venue an administrator has closed.
 *
 * So the branch HUB stays reachable — that is where the state is shown and,
 * for an admin, where the block is lifted — and everything nested under it does
 * not.
 *
 * An admin is exempt on purpose: they are the ones who closed the branch, they
 * may need to look inside it to decide about reopening, and locking the person
 * holding the key out of the room helps nobody.
 *
 * While the branch is loading this renders a spinner rather than the section,
 * because the alternative — render first, redirect on arrival — shows the
 * cashier a working POS for a moment, which is the exact impression this
 * exists to prevent.
 */
const BlockedBranchGuard = () => {
  const { branchId } = useParams();
  const { user } = useAuth();
  const { t } = useLang();

  const id = Number(branchId);
  const valid = Number.isFinite(id) && id > 0;

  const { data, loading } = useAsync(
    () => (valid ? branchRepository.byId(id) : Promise.resolve(null)),
    [id, valid],
  );

  const isAdmin = user?.role === "admin";
  const blocked = !isAdmin && !!data?.is_blocked;

  // One toast per redirect, not one per render.
  const told = useRef(false);
  useEffect(() => {
    if (blocked && !told.current) {
      told.current = true;
      notify.message("error", t("blocking.branchClosed"));
    }
  }, [blocked, t]);

  if (!valid) return <Outlet />;
  if (loading) return <Spinner />;
  if (blocked) return <Navigate to={`/branches/${id}`} replace />;

  return <Outlet />;
};

export default BlockedBranchGuard;
