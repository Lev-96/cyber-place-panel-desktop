import ImageUpload from "@/components/ui/ImageUpload";
import Switch from "@/components/ui/Switch";
import { useLang } from "@/i18n/LanguageContext";

/**
 * What the operator decided about a game's cover:
 * - `file`: a picture chosen in this form (new, or replacing the current one);
 * - `none`: the explicit "no cover" switch — the app then shows its own
 *   "no cover" art for the game.
 * Neither = not decided yet, which a NEW game may not be saved with.
 */
export interface CoverChoice {
  file: File | null;
  none: boolean;
}

export const coverDecided = (choice: CoverChoice, hasCurrent: boolean): boolean =>
  choice.none || choice.file !== null || hasCurrent;

interface Props {
  value: CoverChoice;
  onChange: (next: CoverChoice) => void;
  /** URL of the cover the game already has (edit), if any. */
  currentUrl?: string | null;
  /** The game's name, for the picker's first-letter placeholder. */
  name: string;
  /** Show the "pick one or switch it off" hint (a new game, still undecided). */
  showRequiredHint: boolean;
}

/**
 * The cover section of the game form: the picture, or the switch that says
 * there deliberately is none. Turning the switch on drops a picked file, so
 * the two can never both be sent.
 */
const GameCoverField = ({ value, onChange, currentUrl, name, showRequiredHint }: Props) => {
  const { t } = useLang();

  return (
    <div className="col" style={{ gap: 8 }}>
      {!value.none && (
        <ImageUpload
          label={t("game.cover")}
          name={name}
          initialUrl={currentUrl}
          required
          onChange={(file) => onChange({ file, none: false })}
        />
      )}
      <Switch
        checked={value.none}
        onChange={(none) => onChange({ file: null, none })}
        label={t("game.noCover")}
      />
      <span className="muted" style={{ fontSize: 11 }}>
        {value.none ? t("game.noCoverHint") : t("game.coverHint")}
      </span>
      {showRequiredHint && (
        <span className="error" role="status" style={{ fontSize: 12 }}>
          {t("game.coverRequired")}
        </span>
      )}
    </div>
  );
};

export default GameCoverField;
