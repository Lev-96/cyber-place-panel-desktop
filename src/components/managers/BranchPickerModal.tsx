import { ListSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { useEffect, useState } from "react";

interface Props {
  onClose: () => void;
  /** A branch was settled on — either picked here or the only one there is. */
  onPicked: (branchId: number) => void;
}

/**
 * "Which branch is this manager for?" — asked only when there is something to
 * ask.
 *
 * A manager IS their branch: the row, the scope and everything they can see
 * follow from it. Inside a branch the URL already says which one, so this only
 * exists for the sidebar screen, where it does not.
 *
 * The list comes from the same `/branches` the rest of the panel reads, so it
 * is already scoped server-side: an owner sees their company's branches and an
 * admin sees all of them. Nothing here needs to know which role is asking.
 *
 * One branch answers itself. `onPicked` fires from an effect before anything is
 * rendered, so an owner with a single venue goes straight to the manager form
 * and never sees a dialog whose only option is the one they already have.
 */
const BranchPickerModal = ({ onClose, onPicked }: Props) => {
  const { t } = useLang();
  const { data: branches, loading, error } = useAsync(() => branchRepository.list(), []);
  const [selected, setSelected] = useState<number | null>(null);

  const only = branches?.length === 1 ? branches[0] : null;

  useEffect(() => {
    if (only) onPicked(only.id);
    // `onPicked` closes this component; re-running on a new identity of it
    // would be a loop, so the branch is the only dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only?.id]);

  // Resolved already — render nothing rather than a dialog that is about to
  // disappear.
  if (only) return null;

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0 }}>{t("managers.pickBranch")}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t("managers.pickBranchHint")}</p>

        {loading && <ListSkeleton rows={4} />}
        {error && <div className="error">{error.message}</div>}

        {!loading && !error && (
          branches?.length ? (
            <div className="list" style={{ maxHeight: 320, overflowY: "auto" }}>
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="list-item"
                  onClick={() => setSelected(b.id)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: selected === b.id ? "#07ddf1" : undefined,
                  }}
                >
                  <div>
                    <div className="name">{b.address}</div>
                    <div className="meta">{b.city ?? "—"} · №{b.id}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="muted">{t("managers.noBranches")}</div>
          )
        )}

        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose}>{t("action.cancel")}</Button>
          {/* Mandatory by construction: nothing to continue to until a branch
              is chosen, so the manager cannot be created unbound. */}
          <Button type="button" disabled={selected == null} onClick={() => selected != null && onPicked(selected)}>
            {t("action.continue")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BranchPickerModal;
