import Modal from "@/components/ui/Modal";
import { bonusAmountText } from "@/components/bonus/bonusAmount";
import FixedDialPhoneInput from "@/components/ui/FixedDialPhoneInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
  // Found as the number is typed (2026-11-25, owner): no «Найти».
  const [digits, setDigits] = useState("");
  const applied = useDebouncedValue(digits, 300);
  const list = useAsync(() => bonusRepository.list(branchId, applied || undefined), [branchId, applied]);
  const view = deriveViewState({ loading: list.loading, error: list.error, data: list.data, hasFilters: applied.trim() !== "" });

  return (
    <Modal open onClose={onClose}>
      {/* A card like every dialog of the panel (QA 2026-11-25): its own
          frame and background, centred over the dimmed Start. */}
      <div className="card col" style={{ gap: 12, width: 440, maxWidth: "92vw", padding: 20 }} data-testid="bonus-picker">
        <h3 style={{ margin: 0 }}>{t("bonus.pick.title")}</h3>
        <FixedDialPhoneInput countryCode="AM" value={digits} onChange={setDigits} autoFocus
          ariaLabel={t("bonus.searchPhone")} placeholder="91 123 456" testId="bonus-picker-search" />
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
                <div style={{ fontWeight: 700 }}>{t("bonus.balance").replace("{0}", bonusAmountText(money, a.balance))}</div>
              </button>
            ))}
          </div>
        </StateSwitch>
      </div>
    </Modal>
  );
};

export default BonusCardPicker;
