import { dmyToIso, isoToDmy, maskDmy } from "@/utils/dateMask";
import { useState } from "react";

interface Props {
  label?: string;
  /** Canonical value in ISO `YYYY-MM-DD` (or "" when unset). */
  valueIso: string;
  /** Emits ISO `YYYY-MM-DD`, or "" while the typed date is incomplete/invalid. */
  onChangeIso: (iso: string) => void;
  required?: boolean;
  autoFocus?: boolean;
}

/**
 * Date field that reads and writes `dd.mm.yy` (two-digit year → 20YY)
 * while exposing a canonical ISO value to the form.
 *
 * Deliberately a masked text input, not a native `<input type="date">`:
 * the panel needs the exact dd.mm.yy presentation the admin asked for
 * (the native widget's display format is locale/OS-driven and can't be
 * forced), and Electron's native date/number widgets swallow keystrokes
 * on some Linux WMs — same trap NumberStepper exists to avoid.
 */
const MaskedDateInput = ({ label, valueIso, onChangeIso, required, autoFocus }: Props) => {
  // Seeded once from the incoming ISO; the field then owns its own text
  // (the modal remounts per open, so there is no external-sync case).
  const [text, setText] = useState(() => isoToDmy(valueIso));

  const handle = (raw: string) => {
    const masked = maskDmy(raw);
    setText(masked);
    onChangeIso(dmyToIso(masked) ?? "");
  };

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <input
        className="input"
        inputMode="numeric"
        placeholder="дд.мм.гг"
        value={text}
        onChange={(e) => handle(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        maxLength={8}
      />
    </div>
  );
};

export default MaskedDateInput;
