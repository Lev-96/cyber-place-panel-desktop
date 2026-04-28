import Input from "@/components/ui/Input";

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  sourceLabel?: string;
}

const CommissionInput = ({ value, onChange, disabled, sourceLabel }: Props) => (
  <div className="col" style={{ gap: 6 }}>
    <Input
      label="Commission percent"
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
    <span className="muted" style={{ fontSize: 11 }}>0–100%. {sourceLabel ?? "Stored locally on this device."}</span>
  </div>
);

export default CommissionInput;
