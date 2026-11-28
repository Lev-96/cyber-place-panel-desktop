import { useLang } from "@/i18n/LanguageContext";
import type { Rank } from "@/types/bonus";

/**
 * A Club Card's rank as a small coloured chip (2026-11-25): the same five
 * colours as the player's app, under the branch's own name for it when the
 * owner gave one (`label`), else the standard name.
 */
const RankBadge = ({ rank, label }: { rank?: Rank | null; label?: string | null }) => {
  const { t } = useLang();
  const r: Rank = rank ?? "gamer";
  return <span className={`rank-badge rank-badge--${r}`} data-testid="rank-badge" data-rank={r}>{label || t(`bonus.rank.${r}`)}</span>;
};

export default RankBadge;
