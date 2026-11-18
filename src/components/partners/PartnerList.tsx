import type { IPartner } from "@/api/partners";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { partnerRepository } from "@/repositories/PartnerRepository";
import { useState } from "react";
import PartnerDialog from "./PartnerDialog";
import { termsLine } from "./partnerTerms";

/**
 * The company's partners (2026-11-18): name, the terms in words, how many
 * products are theirs; add, edit, archive (with the in-app confirm, never a
 * native one). An archived partner is shown only when asked, read-only: the
 * server refuses to edit one.
 */
const PartnerList = ({ companyId }: { companyId: number }) => {
  const { t, money } = useLang();
  const confirm = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, error, reload } = useAsync(
    () => partnerRepository.list(companyId, showArchived),
    [companyId, showArchived],
  );
  const [editing, setEditing] = useState<IPartner | "new" | null>(null);

  const archive = async (p: IPartner) => {
    if (!(await confirm(fmt(t("partners.archiveConfirm"), p.name), { destructive: true }))) return;
    try {
      await partnerRepository.archive(p.id);
    } catch {
      return; // the toast said it; the list stays as it was
    }
    void reload();
  };

  return (
    <div className="col" style={{ gap: 12 }} data-testid="partner-list">
      <div className="row-between partner-list__head">
        <Checkbox checked={showArchived} onChange={setShowArchived} label={t("partners.showArchived")} />
        <Button onClick={() => setEditing("new")} data-testid="partner-add">{t("partners.add")}</Button>
      </div>
      <StateSwitch
        view={deriveViewState({ loading, error, data })}
        skeleton={<ListSkeleton />}
        onRetry={() => void reload()}
        error={{ titleKey: "partners.state.errorTitle" }}
        empty={{
          titleKey: "partners.state.emptyTitle",
          descriptionKey: "partners.state.emptyDescription",
          actions: <Button onClick={() => setEditing("new")}>{t("partners.add")}</Button>,
        }}
      >
        <div className="list">
          {(data ?? []).map((p) => (
            <div key={p.id} className="list-item partner-row" style={{ opacity: p.archived ? 0.6 : 1 }} data-testid={`partner-row-${p.id}`}>
              <div className="partner-row__main">
                <div className="name">
                  {p.name}
                  {p.archived && <span className="pill partner-row__badge">{t("partners.archivedBadge")}</span>}
                </div>
                <div className="meta" data-testid="partner-terms">{termsLine(p, t, money)}</div>
                <div className="meta">
                  {[p.phone, typeof p.products_count === "number" ? fmt(t("partners.productsCount"), p.products_count) : null]
                    .filter(Boolean).join(" · ")}
                </div>
                {p.note && <div className="meta partner-row__note">{p.note}</div>}
              </div>
              {!p.archived && (
                <div className="row partner-row__actions" style={{ gap: 6 }}>
                  <Button variant="secondary" onClick={() => setEditing(p)} data-testid="partner-edit">{t("action.edit")}</Button>
                  <Button variant="secondary" onClick={() => void archive(p)} data-testid="partner-archive"
                    style={{ color: "var(--color-danger)", borderColor: "var(--color-danger-border-dim)" }}>
                    {t("partners.archive")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </StateSwitch>
      {editing !== null && (
        <PartnerDialog
          companyId={companyId}
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
    </div>
  );
};

export default PartnerList;
