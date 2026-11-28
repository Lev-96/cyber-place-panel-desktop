import { useLang } from "@/i18n/LanguageContext";
import type { IRating } from "@/types/bonus";
import { compactCount, ratingAverage } from "./ratingFormat";

interface Props {
  name: string | null | undefined;
  /** The player's own photo from Club Card: a data: image, else the initial. */
  avatar?: string | null;
  rating?: IRating | null;
  testId?: string;
}

const isPhoto = (v: string | null | undefined): v is string => typeof v === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(v);

/**
 * The player as staff meet them (2026-11-27, owner, as a taxi app shows its
 * driver): the photo in a ring, the rating every club gave them on a small
 * pill over its foot («★ 4.9»), the name, and how many rated («12 оценок»,
 * «1K»). A player nobody rated yet is «Новый».
 */
const PlayerBadge = ({ name, avatar, rating, testId = "player-badge" }: Props) => {
  const { t } = useLang();
  const avg = ratingAverage(rating);
  const shown = (name ?? "").trim() || t("bonus.noName");
  return (
    <div className="player-badge" data-testid={testId}>
      <div className="player-badge__photo">
        {isPhoto(avatar)
          ? <img src={avatar} alt="" />
          : <span aria-hidden="true">{shown.slice(0, 1).toUpperCase()}</span>}
        <span className={"player-badge__pill" + (avg ? "" : " is-new")} data-testid={`${testId}-rating`}>
          {avg ? `★ ${avg}` : t("bonus.rating.new")}
        </span>
      </div>
      <div className="player-badge__who">
        <strong className="player-badge__name">{shown}</strong>
        <span className="muted player-badge__count" data-testid={`${testId}-count`}>
          {avg ? t("bonus.rating.countOf").replace("{0}", compactCount(rating?.count ?? 0)) : t("bonus.rating.playerNone")}
        </span>
      </div>
    </div>
  );
};

export default PlayerBadge;
