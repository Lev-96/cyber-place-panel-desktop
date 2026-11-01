import { useLang } from "@/i18n/LanguageContext";
import JoystickIcon from "@/components/ui/JoystickIcon";
import type { PadChoice } from "./joystickView";

/**
 * The extra joystick on a running seat, as one switch (2026-10-25).
 *
 * The floor's own screen (GameZone) has one button per room that hands a pad
 * over and, pressed again, takes it back; the cashier wanted the same here in
 * place of the select. Only the CONTROL changed: a press still calls the same
 * `onAdd(slot)` / `onRemove()` the select and the "−" button did, so the
 * server request, its locking, its refusals and the money are untouched.
 *
 * Inside every button is the joystick and nothing else, and nothing is printed
 * beside it either — no price, no rate (owner's call, 2026-10-25): the seat's
 * rate line and the pad line above already say what the seat costs.
 *
 * It is ONE cell of the card's action grid, styled as every other card action
 * (`session-card__btn`), so it is the same height and width as "+ Товар" and
 * "Пауза" beside it. No pad out: one button. A pad out: that button is lit
 * (aria-pressed) and a press takes the last one back; a venue that hands out a
 * fourth controller splits the cell into two equal halves, lit and unlit.
 *
 * Every button is disabled while a change is in flight, so a double press is
 * one pad.
 */
interface Props {
  /** The pad this venue would hand over next, or null when there is none. */
  next: PadChoice | null;
  /** Extra pads in play now (beyond the seat's own kit). */
  extrasOut: number;
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

const BTN = "btn secondary session-card__btn pad-toggle__btn";

const PadToggle = ({
  next, extrasOut, busy, onAdd, onRemove,
  addLabelKey = "session.padChoose", removeLabelKey = "session.padRemove",
  groupLabelKey = "session.joysticks",
}: Props) => {
  const { t } = useLang();
  // A pad with no price set cannot be handed over: the server refuses it.
  const canAdd = next !== null && next.enabled && next.price !== null;
  const groupLabel = groupLabelKey === null ? undefined : t(groupLabelKey);

  return (
    <div className="pad-toggle" role="group" aria-label={groupLabel} data-testid="pad-toggle">
      {extrasOut > 0 && (
        <button
          type="button"
          className={`${BTN} is-on`}
          aria-pressed="true"
          disabled={busy}
          onClick={() => { if (!busy) onRemove(); }}
          title={t(removeLabelKey)}
          aria-label={t(removeLabelKey)}
          data-testid="pad-remove"
        >
          <JoystickIcon size={18} />
        </button>
      )}
      {(extrasOut === 0 || canAdd) && (
        <button
          type="button"
          className={BTN}
          aria-pressed="false"
          disabled={busy || !canAdd}
          onClick={() => { if (!busy && canAdd && next) onAdd(next.slot); }}
          title={t(addLabelKey)}
          aria-label={t(addLabelKey)}
          data-testid="pad-add"
        >
          <JoystickIcon size={18} />
        </button>
      )}
    </div>
  );
};

export default PadToggle;
