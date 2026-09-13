import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import Radio from "@/components/ui/Radio";
import { IBillingSettings, includedJoysticks, MAX_JOYSTICKS } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  onSaved: () => void;
}

/**
 * What the venue does about a joystick beyond the ones the rate covers.
 *
 * There are three answers and the schema states them in ONE nullable number:
 * a figure is the fee, `0` hands pads out for nothing, `null` means this venue
 * does not offer them at all. That is a fine wire format and it was a poor
 * question to put to an operator, because two of the three answers went into
 * the same box and one of them was typing nothing. "Is the empty box zero, or
 * is it no?" is not a question a price screen should make anybody answer.
 *
 * So the choice is the control and the box is its consequence: pick Charged
 * and the price appears, pick Free or Not offered and it does not, because
 * under those two there is no figure to give. All three states stay reachable
 * and each one says in words what it does.
 */
type ExtraMode = "paid" | "free" | "none";

/** The venue's stored figure, read back as the choice that produced it. */
const modeOf = (price: number | null): ExtraMode =>
  price === null ? "none" : price === 0 ? "free" : "paid";

const MODES: ExtraMode[] = ["paid", "free", "none"];
const MODE_LABEL: Record<ExtraMode, string> = {
  paid: "joystickPrice.extraPaid",
  free: "joystickPrice.extraFree",
  none: "joystickPrice.extraNone",
};

/**
 * The venue's joystick rule: how many pads the rate covers, and what happens
 * to the ones beyond them.
 *
 * It was three inputs — the second pad, the third and the fourth — because the
 * schema could express three prices. No venue ever set them differently, so the
 * screen asked an operator three questions with a single answer and left two of
 * them to be forgotten: a venue that filled in only the first found the "+"
 * button refusing the third pad with a sentence about a slot nobody had thought
 * about.
 *
 * **Zero and null are different settings, and the choice above states which.**
 * Zero is "take one, it costs nothing": the pad is handed out, counted and
 * billed as a line at 0. Null is "we do not offer these", and the session card
 * refuses the add with a sentence pointing back at this screen. Clearing the
 * fee used to be the only way to say the second, which left the first
 * reachable only by typing a 0 nobody could tell apart from an empty box.
 *
 * The fee is FIXED per use and the server owns every consequence of it: it goes
 * onto the bill when the pad is handed out and STAYS there when the pad is
 * handed back, whatever the time in between. Nothing here multiplies it by
 * anything.
 *
 * **The allowance is the half venues differ on.** One sells a seat with a
 * single controller and charges for every other; another quotes a room with
 * four and charges for none, which is this select set to 4 and the choice left
 * to whatever it was. A pad inside the allowance is still handed out, still
 * counted and still logged, at zero. The floor is 1 because the session's own
 * controller is always one of them.
 */
const JoystickPricesForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const storedPrice = settings.joystick_price ?? null;
  const storedIncluded = includedJoysticks(settings);
  // A stored 0 belongs to the Free choice and not to the box: a price field
  // showing "0" is the very ambiguity this form exists to remove.
  const stored = storedPrice === null || storedPrice === 0 ? "" : String(storedPrice);

  const [value, setValue] = useState(stored);
  const [mode, setMode] = useState<ExtraMode>(() => modeOf(storedPrice));
  const [included, setIncluded] = useState(storedIncluded);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Numeric compare so a typed "500" matches a stored "500.00" — otherwise
  // Save would light up on every render. An empty box is `undefined` and NOT
  // null: null is a setting the operator picks by name below, and letting the
  // box mean it again is exactly the collision this form removed.
  const typed = value.trim() === "" ? undefined : Number(value);
  /**
   * The one figure the choice resolves to.
   *
   * `undefined` is not a fourth setting: it is "Charged, with nothing typed
   * yet", which is not an answer and must not be sent. It holds Save down
   * rather than guessing, because both plausible guesses (0 and null) are
   * settings the operator can already pick by name right above.
   */
  const outgoing: number | null | undefined =
    mode === "none" ? null : mode === "free" ? 0 : typed;
  const invalid =
    outgoing === undefined || (outgoing !== null && (!Number.isFinite(outgoing) || outgoing < 0));
  const changed = outgoing !== storedPrice || included !== storedIncluded;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy || invalid || outgoing === undefined) return;
    setBusy(true);
    setErr(null);
    try {
      // The whole policy goes back, rounding included: this is a PUT and the
      // server validates it as one object, so sending half of it would blank
      // the other half.
      await billingSettingsRepository.update(
        branchId,
        settings.money_rounding_step,
        settings.money_rounding_mode,
        outgoing,
        included,
      );
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

      {/* How many pads the seat's rate already covers. A select and not a
          number box: the answer is one of four and a free-typed "0" is a seat
          with no controller, which the server refuses anyway. */}
      <label className="col" style={{ gap: 4, maxWidth: 220 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.included")}</span>
        <select
          className="input"
          value={included}
          disabled={busy}
          onChange={(e) => setIncluded(Number(e.target.value))}
          style={{ width: 90 }}
        >
          {Array.from({ length: MAX_JOYSTICKS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <div className="col" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.extra")}</span>
        {/* The app's own radio and not the native control, which renders
            washed-out against this dark UI. The row wraps because "Not
            offered" is a good deal wider in Armenian than in English. */}
        <div
          className="row"
          role="radiogroup"
          aria-label={t("joystickPrice.extra")}
          style={{ gap: 16, flexWrap: "wrap" }}
        >
          {MODES.map((m) => (
            <Radio
              key={m}
              name="cp-joystick-extra"
              checked={mode === m}
              onChange={() => setMode(m)}
              disabled={busy}
              label={t(MODE_LABEL[m])}
            />
          ))}
        </div>
      </div>

      {/* Only under Charged. Under the other two there is no figure to give,
          and a box that cannot mean anything is a box that gets filled in. */}
      {mode === "paid" && (
        <div style={{ maxWidth: 220 }}>
          <PriceInput
            label={t("joystickPrice.extraPrice")}
            value={value}
            onChange={setValue}
            disabled={busy}
          />
        </div>
      )}

      {/* One sentence per choice, so the three are told apart by what they do
          and not by what is in a box. */}
      {mode === "paid" && typed === undefined && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.paidNeedsPrice")}</span>
      )}
      {mode === "free" && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.freeNote")}</span>
      )}
      {mode === "none" && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.noneNote")}</span>
      )}

      {/* The allowance already covers every pad a seat can hold, so whatever
          the choice says is unreachable. Said and not enforced: a venue on
          four today and three tomorrow should not have to re-enter its fee. */}
      {included >= MAX_JOYSTICKS && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.allIncluded")}</span>
      )}

      {err && <div className="error">{err}</div>}

      <div>
        <Button type="submit" disabled={!changed || busy || invalid}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default JoystickPricesForm;
