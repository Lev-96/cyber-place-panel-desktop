import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import RankBadge from "./RankBadge";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import type { IBonusAccount, RankNames } from "@/types/bonus";
import { useState } from "react";

interface Props {
  branchId: number;
  onClose: () => void;
  onPick: (account: IBonusAccount) => void;
  /** The branch's own names for the ranks, when its owner gave them. */
  rankNames?: RankNames;
}

/** «Выбрать игрока»: this branch's cards only, filtered by phone. */
const BonusCardPicker = ({ branchId, onClose, onPick, rankNames }: Props) => {
  const { t, money } = useLang();
  const [phone, setPhone] = useState("");
  const [applied, setApplied] = useState("");
  const list = useAsync(() => bonusRepository.list(branchId, applied || undefined), [branchId, applied]);
  const run = () => { if (phone === applied) void list.reload(); else setApplied(phone); };
  const view = deriveViewState({ loading: list.loading, error: list.error, data: list.data, hasFilters: applied.trim() !== "" });

  return (
    <Modal open onClose={onClose}>
      {/* A card like every dialog of the panel (QA 2026-11-25): its own
          frame and background, centred over the dimmed Start. */}
      <div className="card col" style={{ gap: 12, width: 440, maxWidth: "92vw", padding: 20 }} data-testid="bonus-picker">
        <h3 style={{ margin: 0 }}>{t("bonus.pick.title")}</h3>
        <div className="row" style={{ gap: 6 }}>
          <input className="input" inputMode="tel" autoFocus placeholder={t("bonus.searchPhone")} value={phone}
            onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} data-testid="bonus-picker-search" />
          <Button type="button" variant="secondary" onClick={run}>{t("action.search")}</Button>
        </div>
        <StateSwitch
          view={view}
          skeleton={<ListSkeleton />}
          onRetry={() => void list.reload()}
          error={{ titleKey: "bonus.state.errorTitle" }}
          empty={{ titleKey: "bonus.state.emptyTitle", descriptionKey: "bonus.state.emptyDescription" }}
          noResults={{ descriptionKey: "bonus.state.noResultsDescription" }}
        >
          <div className="list" style={{ maxHeight: 360, overflowY: "auto" }}>
            {(list.data ?? []).map((a) => (
              <button key={a.id} type="button" className="list-item" onClick={() => onPick(a)} data-testid={`bonus-pick-${a.id}`}
                style={{ width: "100%", textAlign: "left", cursor: "pointer" }}>
                <div>
                  <div className="name row" style={{ gap: 8, alignItems: "center" }}>{a.name || t("bonus.noName")} <RankBadge rank={a.rank} label={rankNames?.[a.rank ?? "gamer"]} /></div>
                  <div className="meta">{a.phone}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{t("bonus.balance").replace("{0}", money(Number(a.balance)))}</div>
              </button>
            ))}
          </div>
        </StateSwitch>
      </div>
    </Modal>
  );
};

export default BonusCardPicker;
