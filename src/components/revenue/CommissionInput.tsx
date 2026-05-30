import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  sourceLabel?: string;
}

const CommissionInput = ({ value, onChange, disabled, sourceLabel }: Props) => {
  const { t } = useLang();
  return (
    <div className="col" style={{ gap: 6 }}>
      <Input
        label={t("commission.label")}
        type="number"
        min={0}
        max={100}
        step="0.1"
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const num = parseFloat(e.target.value.replace(",", "."));
          if (Number.isFinite(num)) onChange(num);
          else if (e.target.value === "") onChange(0);
        }}
      />
      <span className="muted" style={{ fontSize: 11 }}>{sourceLabel ? `0–100%. ${sourceLabel}` : t("commission.hint")}</span>
    </div>
  );
};

export default CommissionInput;
