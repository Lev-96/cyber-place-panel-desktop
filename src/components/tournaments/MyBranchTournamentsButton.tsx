import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/state";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Sticky call-to-action shown on the global tournaments screen: jumps the
 * operator straight into THEIR branch's tournaments.
 *
 *   - manager  → their single assigned branch, no prompt.
 *   - owner, 1 branch  → that branch, no prompt.
 *   - owner, N branches → a picker, then the chosen branch.
 *
 * Admins (who have no "own branch") don't see it. Branch fetch is lazy — only
 * on click — so the tournaments screen has no extra load on mount.
 */
const MyBranchTournamentsButton = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const role = user?.role;
  const [picking, setPicking] = useState<IBranchApi[] | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Why the jump did not happen. "No branch" is a fact about the account, not
   * a failure, so it is not drawn as one; a failed read is, with Retry.
   */
  const [outcome, setOutcome] = useState<{ kind: "noBranch" } | { kind: "error"; error: unknown } | null>(null);

  if (role !== "company_owner" && role !== "manager") return null;

  const goTo = (branchId: number) => navigate(`/branches/${branchId}/tournaments`);

  const onClick = async () => {
    setOutcome(null);
    if (role === "manager") {
      const bid = user?.dashboard?.branch_id;
      if (typeof bid === "number") goTo(bid);
      else setOutcome({ kind: "noBranch" });
      return;
    }
    // Owner: resolve their company's branches, then route or prompt.
    setBusy(true);
    try {
      const companyId = user?.dashboard?.company_id;
      const branches = await branchRepository.list(companyId ? { company_id: companyId } : {});
      if (branches.length === 0) setOutcome({ kind: "noBranch" });
      else if (branches.length === 1) goTo(branches[0].id);
      else setPicking(branches);
    } catch (e) {
      setOutcome({ kind: "error", error: e });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="tournaments-cta">
        <div className="col" style={{ gap: 4, alignItems: "flex-end" }}>
          <Button onClick={onClick} disabled={busy}>{busy ? "…" : t("tournaments.goToMyBranch")}</Button>
          {outcome?.kind === "noBranch" && <span className="muted" role="status" style={{ fontSize: 12 }}>{t("tournaments.noBranch")}</span>}
          {outcome?.kind === "error" && (
            <ErrorState size="compact" error={outcome.error} onRetry={() => void onClick()} titleKey="branchesList.state.errorTitle" descriptionKey={null} />
          )}
        </div>
      </div>

      {picking && (
        <Modal open onClose={() => setPicking(null)}>
          <div className="card" style={{ width: 440, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ margin: 0 }}>{t("tournaments.pickBranch")}</h2>
            <div className="list">
              {picking.map((b) => (
                <div key={b.id} className="list-item" onClick={() => { setPicking(null); goTo(b.id); }}>
                  <div>
                    <div className="name">{b.address}</div>
                    <div className="meta">{[b.city, b.country].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="row-between">
              <Button variant="secondary" onClick={() => setPicking(null)}>{t("action.cancel")}</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default MyBranchTournamentsButton;
