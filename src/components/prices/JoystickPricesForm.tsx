import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import { IJoystickPrice, JOYSTICK_SLOTS } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { joystickPriceRepository } from "@/repositories/JoystickPriceRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  prices: IJoystickPrice[];
  onSaved: () => void;
}

/**
 * Per-hour rates for the 2nd, 3rd and 4th joystick.
 *
 * Three fixed rows rather than an add/remove list: the set is closed at four
 * pads and the first is the session itself, so "which slots exist" is not a
 * decision an operator makes. What they decide is what each one costs, and
 * whether it is offered at all.
 *
 * **An empty cell is a value, not a gap.** It means that joystick cannot be
 * added — the session card refuses with a sentence naming the slot. Blanking a
 * priced slot therefore DELETES its price, which is the only way to withdraw
 * one; sessions already using it are untouched, because their rate was frozen
 * onto their own rows when the pad was added.
 */
const JoystickPricesForm = ({ branchId, prices, onSaved }: Props) => {
  const { t } = useLang();
  const stored = (slot: number): string => {
    const row = prices.find((p) => p.slot === slot);
    return row ? String(row.price_per_hour) : "";
  };

  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(JOYSTICK_SLOTS.map((slot) => [slot, stored(slot)])),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Numeric compare so a typed "500" matches a stored "500.00", and "" matches
  // unset — otherwise Save would light up for every render.
  const changed = JOYSTICK_SLOTS.some((slot) => {
    const cur = values[slot]?.trim() === "" ? null : Number(values[slot]);
    const orig = stored(slot) === "" ? null : Number(stored(slot));
    return cur !== orig;
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      for (const slot of JOYSTICK_SLOTS) {
        const typed = values[slot]?.trim() ?? "";
        const row = prices.find((p) => p.slot === slot);

        if (typed === "") {
          // Withdrawn. Nothing to do if it was never offered.
          if (row) await joystickPriceRepository.remove(row.id);
          continue;
        }

        const amount = Number(typed);
        if (!Number.isFinite(amount) || amount < 0) continue;
        if (row && Number(row.price_per_hour) === amount) continue;

        // The endpoint upserts on (branch, slot), so one call covers both
        // "price it for the first time" and "change what it costs".
        await joystickPriceRepository.save(branchId, slot, amount);
      }
      notify.message("success", t("joystickPrice.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.hint")}</span>

      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        {JOYSTICK_SLOTS.map((slot) => (
          <div key={slot} style={{ minWidth: 160 }}>
            <PriceInput
              label={t("joystickPrice.slot").replace("{0}", String(slot))}
              value={values[slot] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [slot]: v }))}
              disabled={busy}
            />
          </div>
        ))}
      </div>

      {err && <div className="error">{err}</div>}

      <div>
        <Button type="submit" disabled={!changed || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default JoystickPricesForm;
