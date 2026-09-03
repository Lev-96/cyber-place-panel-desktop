import Button from "@/components/ui/Button";
import { IBillingSettings, MoneyRoundingMode } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { joystickPriceRepository } from "@/repositories/JoystickPriceRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  onSaved: () => void;
}

/** Steps an operator actually asks for. 0 is "leave the amount alone". */
const STEPS = [0, 10, 50, 100, 500, 1000] as const;
const MODES: MoneyRoundingMode[] = ["up", "nearest", "down"];

/**
 * How the venue rounds the FINAL figure on a bill.
 *
 * The distinction the copy here has to carry, because getting it wrong is a
 * different product: the TIME is measured, the MONEY is rounded. A 45-minute
 * session ran 45 minutes and costs 1 125 at 1 500/h; this decides whether the
 * cashier asks for 1 125, 1 130 or 1 200.
 *
 * Every branch starts at "do not round", which is what every bill in the system
 * has always been. The worked example below updates as the operator chooses, so
 * they can see the answer before they commit a venue to it rather than after a
 * player queries a receipt.
 */
const MoneyRoundingForm = ({ branchId, settings, onSaved }: Props) => {
  const { t, money } = useLang();
  const [step, setStep] = useState<number>(settings.money_rounding_step);
  const [mode, setMode] = useState<MoneyRoundingMode>(settings.money_rounding_mode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const changed = step !== settings.money_rounding_step || mode !== settings.money_rounding_mode;

  /**
   * The same arithmetic the server applies, on one fixed sample.
   *
   * A second implementation of a money rule is normally the thing to avoid, and
   * this one is deliberate and safe: it prices nothing, it is never sent
   * anywhere, and the sample is a constant. Its only job is to answer "what
   * does this setting do" before the operator finds out from a receipt.
   */
  const SAMPLE = 1125;
  const preview = (): number => {
    if (step <= 0) return SAMPLE;
    const floor = Math.floor(SAMPLE / step) * step;
    if (floor === SAMPLE) return SAMPLE;
    if (mode === "down") return floor;
    if (mode === "up") return floor + step;
    return SAMPLE - floor >= step / 2 ? floor + step : floor;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await joystickPriceRepository.saveBillingSettings(branchId, step, mode);
      notify.message("success", t("rounding.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <span className="muted" style={{ fontSize: 12 }}>{t("rounding.hint")}</span>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("rounding.step")}</span>
          <select
            className="input"
            value={step}
            disabled={busy}
            onChange={(e) => setStep(Number(e.target.value))}
          >
            {STEPS.map((s) => (
              <option key={s} value={s}>{s === 0 ? t("rounding.stepNone") : money(s)}</option>
            ))}
          </select>
        </label>

        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("rounding.mode")}</span>
          <select
            className="input"
            value={mode}
            // Meaningless without a step, and a disabled control says so more
            // clearly than a value that changes nothing.
            disabled={busy || step === 0}
            onChange={(e) => setMode(e.target.value as MoneyRoundingMode)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>{t(`rounding.mode.${m}`)}</option>
            ))}
          </select>
        </label>

        <span className="muted" style={{ fontSize: 12, paddingBottom: 8 }}>
          {t("rounding.example").replace("{0}", money(SAMPLE)).replace("{1}", money(preview()))}
        </span>
      </div>

      {err && <div className="error">{err}</div>}

      <div>
        <Button type="submit" disabled={!changed || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default MoneyRoundingForm;
