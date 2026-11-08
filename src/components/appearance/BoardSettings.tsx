import RangeSlider from "@/components/ui/RangeSlider";
import Switch from "@/components/ui/Switch";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { GAP_LIMITS, type BoardGeometry } from "@/preferences/uiPreferences";

/**
 * The Active Places board's own spacing (2026-11-03): the space between rows,
 * a slider inside limits taken from the board itself (`GAP_LIMITS`), or left
 * to the standard (a switch). The card size, «Без прокрутки», the side
 * spacing and the column count were removed on 2026-11-04 (owner: not used).
 */
interface Props {
  value: BoardGeometry;
  onChange: (patch: Partial<BoardGeometry>) => void;
}

/** The gap the stylesheet gives right now (the density's), shown while "standard". */
const standardGap = (): number => {
  if (typeof document === "undefined") return 42;
  const raw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap-grid"));
  return Number.isFinite(raw) ? raw : 42;
};
const clampGap = (n: number) =>
  Math.min(GAP_LIMITS.max, Math.max(GAP_LIMITS.min, Math.round(n / GAP_LIMITS.step) * GAP_LIMITS.step));

const GapField = ({ label, value, testId, onChange }: {
  label: string; value: number | null; testId: string; onChange: (v: number | null) => void;
}) => {
  const { t } = useLang();
  const auto = value === null;
  return (
    <div className="col appearance-field">
      <RangeSlider
        label={label}
        value={auto ? clampGap(standardGap()) : value}
        min={GAP_LIMITS.min}
        max={GAP_LIMITS.max}
        step={GAP_LIMITS.step}
        format={(v) => fmt(t("appearance.cards.px"), v)}
        disabled={auto}
        testId={`${testId}-slider`}
        onChange={(v) => onChange(clampGap(v))}
      />
      <Switch
        size="md"
        checked={auto}
        onChange={(on) => onChange(on ? null : clampGap(standardGap()))}
        label={t("appearance.cards.gapAuto")}
        testId={`${testId}-auto`}
      />
    </div>
  );
};

const BoardSettings = ({ value, onChange }: Props) => {
  const { t } = useLang();
  return (
    <GapField label={t("appearance.cards.gapY")} value={value.gap_y} testId="board-gap-y" onChange={(gap_y) => onChange({ gap_y })} />
  );
};

export default BoardSettings;
