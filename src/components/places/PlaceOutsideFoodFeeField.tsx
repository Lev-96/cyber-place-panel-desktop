import PriceInput from "@/components/ui/PriceInput";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";

interface Props {
  /** The box, AMD as a string: empty = like the branch, "0" = not charged here. */
  value: string;
  onChange: (value: string) => void;
  /**
   * The branch's figure for this place's tier, as its policy says:
   * a number, null (the branch does not charge that tier), or undefined when
   * it is not known (still loading, or a backend that predates the fee).
   */
  branchFee: number | null | undefined;
  disabled?: boolean;
}

/**
 * «Доплата за свои продукты на этом месте» (2026-11-13, owner): a room's own
 * fee for a player who brings their own food. The hint says what empty means
 * HERE, with the branch's figure for this place's tier when it is known;
 * nothing is resolved on this side (the server picks place, then tier).
 */
const PlaceOutsideFoodFeeField = ({ value, onChange, branchFee, disabled }: Props) => {
  const { t, money } = useLang();
  const hint = branchFee === undefined
    ? t("place.outsideFood.hint")
    : branchFee === null
      ? t("place.outsideFood.hintBranchNone")
      : fmt(t("place.outsideFood.hintBranch"), money(branchFee));
  return (
    <div className="col place-outside-food">
      <PriceInput
        label={t("place.outsideFood")}
        value={value}
        onChange={onChange}
        placeholder={t("place.outsideFood.placeholder")}
        disabled={disabled}
      />
      <span className="muted place-outside-food__hint" data-testid="place-outside-food-hint">{hint}</span>
    </div>
  );
};

export default PlaceOutsideFoodFeeField;
