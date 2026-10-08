import type { IGameApi } from "@/api/games";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { platformLabel } from "@/utils/platform";
import { useId } from "react";

interface Props {
  games: readonly IGameApi[];
  /** Ids already in the branch; null when the form has no branch list. */
  inBranch: ReadonlySet<number> | null;
  /** Normalised exact match, if any: that row is the one Save would flag. */
  exactId: number | null;
  busy: boolean;
  onUse: (game: IGameApi) => void;
}

/**
 * "Already in the catalogue": existing games matching the name being typed,
 * shown in the flow under the name field (not a floating popup) so nothing
 * covers the platform row. Each row says where it already lives and offers the
 * same "Use existing" answer as the duplicate notice.
 */
const GameSuggestions = ({ games, inBranch, exactId, busy, onUse }: Props) => {
  const { t } = useLang();
  const titleId = useId();
  if (games.length === 0) return null;

  return (
    <section className="game-suggest" aria-labelledby={titleId}>
      <span id={titleId} className="game-suggest__title">{t("game.suggest.title")}</span>
      <ul className="game-suggest__list">
        {games.map((g) => (
          <li key={g.id} className={g.id === exactId ? "game-suggest__row game-suggest__row--exact" : "game-suggest__row"}>
            <span className="game-suggest__name" title={g.name}>{g.name}</span>
            <span className="game-suggest__meta">{platformLabel(g.platform)}</span>
            {inBranch?.has(g.id) && <span className="price-badge price-badge--success game-suggest__badge">{t("game.suggest.inBranch")}</span>}
            <Button
              type="button"
              variant="secondary"
              className="game-suggest__use"
              onClick={() => onUse(g)}
              disabled={busy}
              aria-label={fmt(t("game.suggest.useNamed"), g.name, platformLabel(g.platform))}
            >
              {t("game.exists.useExisting")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default GameSuggestions;
