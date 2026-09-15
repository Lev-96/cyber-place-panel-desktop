import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import Radio from "@/components/ui/Radio";
import { IBillingSettings, JoystickPricingMode, JoystickStrategyMode, MAX_JOYSTICKS, PRICING_MODES, STRATEGY_MODES, chargedSlotsOf, includedJoysticks, joystickSetupOf, maxJoystickSlotOf, pricingModeOf, strategyModeOf } from "@/api/joystickPrices";
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

/**
 * The shapes the screen offers, which are not the shapes the column can hold.
 *
 * "3" and "3/4" are the two an owner picks between; the question underneath
 * turns the first into either "only the third" or "the third and the fourth,
 * priced apart". "4" is not on the menu — it is the legacy answer "only the
 * fourth pad is charged", kept selectable ONLY for a branch already on it so
 * that opening this screen cannot quietly re-price that venue.
 */
type Scope = "" | "3" | "3/4" | "4";

/**
 * `""` is "this venue has not answered", which is what every branch is until
 * somebody opens this screen, and it must stay expressible: without it the form
 * would light Save the instant it rendered and an owner who only came to read
 * the page could save a choice they never made.
 */
const scopeChoices = (stored: string | null): Scope[] => {
  if (stored === null) return ["", "3", "3/4"];

  return stored === "4" ? ["3", "4", "3/4"] : ["3", "3/4"];
};

const scopeOf = (setup: "only3" | "separate" | "shared", stored: string | null): Scope => {
  if (stored === null) return "";
  if (stored === "4") return "4";

  return setup === "shared" ? "3/4" : "3";
};

const JoystickPricesForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const storedPrice = settings.joystick_price ?? null;
  const storedPrice4 = settings.joystick_price_4 ?? null;
  const storedIncluded = includedJoysticks(settings);
  const storedMaxSlot = maxJoystickSlotOf(settings);
  const storedSlots = chargedSlotsOf(settings);
  const storedMode = pricingModeOf(settings);
  const storedClubMode = strategyModeOf(settings);
  const storedSetup = joystickSetupOf(settings);
  // A stored 0 belongs to the Free choice and not to the box: a price field
  // showing "0" is the very ambiguity this form exists to remove.
  const stored = storedPrice === null || storedPrice === 0 ? "" : String(storedPrice);
  const stored4 = storedPrice4 === null ? "" : String(storedPrice4);

  const [value, setValue] = useState(stored);
  const [value4, setValue4] = useState(stored4);
  const [mode, setMode] = useState<ExtraMode>(() => modeOf(storedPrice));
  const [scope, setScope] = useState<Scope>(() => scopeOf(storedSetup, storedSlots));
  // The answer to "will you hand out a fourth?", which only the "3" scope asks.
  const [fourth, setFourth] = useState(storedSetup === "separate");
  const [pricingMode, setPricingMode] = useState<JoystickPricingMode>(storedMode);
  // WHICH strategies this club allows. A separate question from the venue's own
  // answer above: one club runs everything on the hourly model, another lets
  // the cashier decide seat by seat.
  const [clubMode, setClubMode] = useState<JoystickStrategyMode>(storedClubMode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The three shapes, derived from the two controls rather than stored as a
  // third piece of state that could disagree with them.
  const separate = scope === "3" && fourth;
  const setup = scope !== "3" ? "shared" : fourth ? "separate" : "only3";
  // What the server is told. A venue on the legacy "only the fourth is
  // charged" answer keeps it: the screen no longer offers that shape, but
  // silently rewriting a branch's prices because its answer is not on the menu
  // any more is not a thing a price screen may do.
  const outgoingSlots: string | null =
    scope === "" ? null : scope === "4" ? "4" : scope === "3/4" || fourth ? "3,4" : "3";
  // An unanswered venue keeps the ceiling it already had: choosing nothing is
  // not a decision to start or stop offering a fourth pad.
  const outgoingMaxSlot = scope === "" ? storedMaxSlot : setup === "only3" ? 3 : MAX_JOYSTICKS;

  // Numeric compare so a typed "500" matches a stored "500.00" — otherwise
  // Save would light up on every render. An empty box is `undefined` and NOT
  // null: null is a setting the operator picks by name below, and letting the
  // box mean it again is exactly the collision this form removed.
  const typed = value.trim() === "" ? undefined : Number(value);
  const typed4 = value4.trim() === "" ? undefined : Number(value4);
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
  /**
   * The fourth pad's own figure, and `null` in every shape that does not have
   * one. Null is what puts the venue back on a single shared price, so it is
   * the correct value for "3/4", for "only the third", and for a venue that
   * hands its pads out free or not at all.
   */
  const outgoing4: number | null | undefined =
    separate && mode === "paid" ? typed4 : null;

  const badFigure = (n: number | null | undefined): boolean =>
    n === undefined || (n !== null && (!Number.isFinite(n) || n < 0));
  const invalid = badFigure(outgoing) || badFigure(outgoing4);

  const changed =
    outgoing !== storedPrice
    || outgoing4 !== storedPrice4
    || outgoingSlots !== storedSlots
    || outgoingMaxSlot !== storedMaxSlot
    || pricingMode !== storedMode
    || clubMode !== storedClubMode;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy || invalid || outgoing === undefined || outgoing4 === undefined) return;
    setBusy(true);
    setErr(null);
    try {
      // The whole policy goes back, rounding included: this is a PUT and the
      // server validates it as one object, so sending half of it would blank
      // the other half.
      await billingSettingsRepository.update(branchId, {
        money_rounding_step: settings.money_rounding_step,
        money_rounding_mode: settings.money_rounding_mode,
        joystick_price: outgoing,
        joystick_included: storedIncluded,
        joystick_charged_slots: outgoingSlots,
        joystick_pricing_mode: pricingMode,
        joystick_price_4: outgoing4,
        joystick_max_slot: outgoingMaxSlot,
        joystick_strategy_mode: clubMode,
      });
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

      {/* WHICH strategies this club allows at all.
          First, because it decides whether the select below is the venue's
          single answer or merely its default: under "both" the cashier picks
          one when they start a seat, and that choice is frozen for the session. */}
      <div className="col" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.clubMode")}</span>
        <div
          className="col"
          role="radiogroup"
          aria-label={t("joystickPrice.clubMode")}
          style={{ gap: 8 }}
        >
          {STRATEGY_MODES.map((m) => (
            <Radio
              key={m}
              name="cp-joystick-club-mode"
              checked={clubMode === m}
              onChange={() => setClubMode(m)}
              disabled={busy}
              label={t(`joystickPrice.clubMode.${m}`)}
            />
          ))}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          {t(clubMode === "both"
            ? "joystickPrice.clubModeExplain.both"
            : "joystickPrice.clubModeExplain.single")}
        </span>
      </div>

      {/* HOW a pad is priced by default. Under "both" this is what a seat
          falls back to when nobody chooses; otherwise it is the only answer.
          The same 500 is either a fee owed once or a rate the hour carries
          while the pad is out. */}
      <label className="col" style={{ gap: 4, maxWidth: 320 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.strategy")}</span>
        <select
          className="input"
          value={pricingMode}
          disabled={busy}
          onChange={(e) => setPricingMode(e.target.value as JoystickPricingMode)}
        >
          {PRICING_MODES.map((m) => (
            <option key={m} value={m}>{t(`joystickPrice.strategy.${m}`)}</option>
          ))}
        </select>
      </label>
      <span className="muted" style={{ fontSize: 12 }}>
        {t(`joystickPrice.strategyExplain.${pricingMode}`)}
      </span>

      {/* WHICH pads this venue hands out. The first two are the kit every seat
          comes with; this names the ones beyond it. */}
      <label className="col" style={{ gap: 4, maxWidth: 260 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.extra")}</span>
        <select
          className="input"
          value={scope}
          disabled={busy}
          onChange={(e) => setScope(e.target.value as Scope)}
        >
          {scopeChoices(storedSlots).map((c) => (
            <option key={c} value={c}>
              {c === "" ? t("joystickPrice.appliesNotSet") : t(`joystickPrice.applies.${c === "3/4" ? "3,4" : c}`)}
            </option>
          ))}
        </select>
      </label>

      {/* Asked only for "3", because "3/4" has already answered it: one price
          for an extra pad whichever one it is. */}
      {scope === "3" && (
        <div className="col" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.useFourth")}</span>
          <div
            className="row"
            role="radiogroup"
            aria-label={t("joystickPrice.useFourth")}
            style={{ gap: 16, flexWrap: "wrap" }}
          >
            <Radio
              name="cp-joystick-fourth"
              checked={!fourth}
              onChange={() => setFourth(false)}
              disabled={busy}
              label={t("joystickPrice.no")}
            />
            <Radio
              name="cp-joystick-fourth"
              checked={fourth}
              onChange={() => setFourth(true)}
              disabled={busy}
              label={t("joystickPrice.yes")}
            />
          </div>
        </div>
      )}

      {/* What the shape means in a sentence, because "3" on its own does not
          say whether a fourth pad exists at this venue. */}
      <span className="muted" style={{ fontSize: 12 }}>
        {scope === ""
          ? t("joystickPrice.appliesFallback").replace("{0}", String(storedIncluded + 1))
          : scope === "4"
            ? t("joystickPrice.appliesExplain.4")
            : t(`joystickPrice.setupExplain.${setup}`)}
      </span>

      <div className="col" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.charging")}</span>
        {/* The app's own radio and not the native control, which renders
            washed-out against this dark UI. The row wraps because "Not
            offered" is a good deal wider in Armenian than in English. */}
        <div
          className="row"
          role="radiogroup"
          aria-label={t("joystickPrice.charging")}
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
          and a box that cannot mean anything is a box that gets filled in.
          One box or two, decided by the shape above — the fourth pad gets its
          own only when the venue said it prices it apart. */}
      {mode === "paid" && (
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 220 }}>
            <PriceInput
              label={t(setup === "shared" ? "joystickPrice.priceShared" : "joystickPrice.price3")}
              value={value}
              onChange={setValue}
              disabled={busy}
            />
          </div>
          {separate && (
            <div style={{ maxWidth: 220 }}>
              <PriceInput
                label={t("joystickPrice.price4")}
                value={value4}
                onChange={setValue4}
                disabled={busy}
              />
            </div>
          )}
        </div>
      )}

      {/* One sentence per choice, so the three are told apart by what they do
          and not by what is in a box. */}
      {mode === "paid" && typed === undefined && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.paidNeedsPrice")}</span>
      )}
      {mode === "paid" && separate && typed4 === undefined && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.fourthNeedsPrice")}</span>
      )}
      {mode === "free" && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.freeNote")}</span>
      )}
      {mode === "none" && (
        <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.noneNote")}</span>
      )}

      {err && <div className="error">{err}</div>}

      <div>
        <Button type="submit" disabled={!changed || busy || invalid}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default JoystickPricesForm;
