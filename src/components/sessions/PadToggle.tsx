import { useLang } from "@/i18n/LanguageContext";
import JoystickIcon from "@/components/ui/JoystickIcon";
import type { PadChoice } from "./joystickView";

/**
 * The extra joystick on a running seat, as one "+🎮" switch (2026-10-25).
 *
 * The floor's own screen (GameZone) has one button per room that hands a pad
 * over and, pressed again, takes it back; the cashier wanted the same here in
 * place of the select. Only the CONTROL changed: a press still calls the same
 * `onAdd(slot)` / `onRemove()` the select and the "−" button did, so the
 * server request, its locking, its refusals and the money are untouched.
 * (GameZone also re-prices the whole session when the pad goes in; Cyber Place
 * deliberately does not — an hourly pad bills only the time it was out.)
 *
 * Inside every button is the joystick and nothing else; what it costs and
 * how many are out is the caption beside them (owner's call, 2026-10-25).
 * - No extra pad out: one button; the caption says what the next pad costs —
 *   on an hourly seat the surcharge AND the seat's rate after it ("+500/h →
 *   1 500/h"), on a fixed seat the one-off fee ("+500"). Disabled when the
 *   venue has no pad to give.
 * - A pad out: that button is lit (aria-pressed) and a press takes the last
 *   one back. A venue that hands out a fourth controller keeps a second,
 *   unlit button for it beside the lit one.
 *
 * Every button is disabled while a change is in flight, so a double press is
 * one pad.
 */
interface Props {
  /** The pad this venue would hand over next, or null when there is none. */
  next: PadChoice | null;
  /** Extra pads in play now (beyond the seat's own kit). */
  extrasOut: number;
  /** How this seat bills its pads: the server's rule. */
  hourly: boolean;
  /** The seat's rate now, pads included; null on a free seat. */
  currentRate: number | null;
  busy: boolean;
  onAdd: (slot: number) => void;
  onRemove: () => void;
  /**
   * Accessible names for the two buttons. A venue that charges ONE payment
   * for its extras names them "hand out / take back the joystick", which is
   * how its switch has always been told apart from the per-pad control.
   */
  addLabelKey?: string;
  removeLabelKey?: string;
  /** The group's name; null for the charge-once switch, which is no menu. */
  groupLabelKey?: string | null;
}

const PadToggle = ({
  next, extrasOut, hourly, currentRate, busy, onAdd, onRemove,
  addLabelKey = "session.padChoose", removeLabelKey = "session.padRemove",
  groupLabelKey = "session.joysticks",
}: Props) => {
  const { t, money } = useLang();
  const perHour = t("session.perHourShort");

  const priceOf = (c: PadChoice): string => {
    if (c.price === null) return t("session.padNoPrice");
    // Two different zeros: what the venue charges, and a payment already taken
    // on THIS seat that covers the controllers after it.
    if (c.feeTaken) return t("session.padFeeTaken");
    if (c.price === 0) return t("session.padFree");
    if (!hourly) return `+${money(c.price)}`;
    const after = currentRate === null ? null : currentRate + c.price;
    return `+${money(c.price)}${perHour}` + (after === null ? "" : ` → ${money(after)}${perHour}`);
  };

  const canAdd = next !== null && next.enabled && next.price !== null;
  const groupLabel = groupLabelKey === null ? undefined : t(groupLabelKey);

  // What the buttons do, said BESIDE them: inside each button is the joystick
  // and nothing else (owner's call, 2026-10-25). How many are out, then what
  // the next one would cost.
  const caption = [
    extrasOut > 0 ? `${t("session.padOutCount")}: ${extrasOut}` : null,
    // The next pad's cost while there is one to hand out — and, on a seat
    // with none out, also when there is not ("no price set"), so a disabled
    // button is never silent about why.
    next !== null && (canAdd || extrasOut === 0) ? priceOf(next) : null,
  ].filter((x): x is string => x !== null).join(" · ");

  return (
    <div className="pad-toggle" role="group" aria-label={groupLabel} data-testid="pad-toggle">
      <div className="pad-toggle__row">
        {extrasOut > 0 && (
          <button
            type="button"
            className="pad-toggle__btn is-on"
            aria-pressed="true"
            disabled={busy}
            onClick={() => { if (!busy) onRemove(); }}
            title={t(removeLabelKey)}
            aria-label={t(removeLabelKey)}
            data-testid="pad-remove"
          >
            <JoystickIcon size={22} />
          </button>
        )}
        {(extrasOut === 0 || canAdd) && (
          <button
            type="button"
            className="pad-toggle__btn"
            aria-pressed="false"
            disabled={busy || !canAdd}
            onClick={() => { if (!busy && canAdd && next) onAdd(next.slot); }}
            title={t(addLabelKey)}
            aria-label={t(addLabelKey)}
            data-testid="pad-add"
          >
            <JoystickIcon size={22} />
          </button>
        )}
      </div>
      {caption !== "" && <span className="pad-toggle__caption" data-testid="pad-caption">{caption}</span>}
    </div>
  );
};

export default PadToggle;
