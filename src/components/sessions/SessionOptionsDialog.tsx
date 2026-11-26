import { bonusOffer } from "@/components/bonus/bonusAmount";
import Button from "@/components/ui/Button";
import PaymentEditor from "@/components/payments/PaymentEditor";
import { checkPayment, emptyPaymentDraft, prepaidPaymentFields, type PaymentDraft } from "@/components/payments/paymentSplit";
import { useBoundBonusCard } from "@/components/bonus/useBoundBonusCard";
import JoystickIcon from "@/components/ui/JoystickIcon";
import Checkbox from "@/components/ui/Checkbox";
import PriceInput from "@/components/ui/PriceInput";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Spinner from "@/components/ui/Spinner";
import { notify } from "@/ui/notify";
import { MAX_JOYSTICKS } from "@/api/joystickPrices";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { durationLabel } from "@/utils/durationLabel";
import { centsWhenFractional } from "@/i18n/currency";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { sessionRepository, type ISessionRateChange } from "@/repositories/SessionRepository";
import { ISessionApi, ISessionHourlyNow } from "@/types/sessions";
import { platformGroup, platformLabel } from "@/utils/platform";
import { useCallback, useEffect, useState } from "react";
import {
  claimedFromOf,
  offeredMinutesOf,
  seatUnavailableBodyOf,
  type SeatUnavailableBody,
} from "@/api/seatUnavailable";
import type { IExtensionAlternative, IExtensionOptions, ILimitChoice, ILimitQuote, ITimeQuote, SessionLimitFrom } from "@/api/sessions";
import SectionTabs from "@/components/ui/SectionTabs";
import ChoiceCards from "@/components/ui/ChoiceCards";
import DurationInput from "./DurationInput";
import UnpaidToggle from "./UnpaidToggle";
import ReminderSection from "./ReminderSection";
import HourlyRateSection from "./HourlyRateSection";
import OutsideFoodRateSection from "./OutsideFoodRateSection";
import QuotedPrice from "./QuotedPrice";
import { EMPTY_DRAFT, draftMinutes, type DurationDraft } from "./durationModel";
import { quoteFor, useServerQuote } from "./useServerQuote";
import { useMinuteTick } from "./useMinuteTick";
import { sessionSeatLine } from "./seatLine";

interface Props {
  session: ISessionApi;
  /** The place's platform, so joysticks are offered only where they mean something. */
  platform?: string | null;
  onClose: () => void;
  /** Called after every successful change with the session the server returned. */
  onChanged: (session: ISessionApi) => void;
  /** A platform's display name; the board passes the branch's own (one shared read). */
  platformName?: (slug: string) => string;
  /** The seat as its card names it, «№4 · Hall VIP» (2026-11-22); absent: the row's own. */
  seat?: string;
}


/**
 * Everything a cashier can change about a session that is already running.
 *
 * One dialog rather than four buttons on the tile: the board card is 160px at
 * its narrowest and already carries a platform, a name, a timer and a tariff.
 * Four more controls there is how a grid goes ragged and how a cashier presses
 * "unlimited" reaching for "stop".
 *
 * ## The backend is the source of truth, and this respects that literally
 *
 * Every action returns the whole session and this replaces its copy with it.
 * Nothing here computes a joystick count, an end time or a total — a card that
 * did would be right until a second cashier touched the same seat, and then
 * quietly wrong on one of the two screens.
 *
 * Refusals are shown verbatim. The server answers a blocked "unlimited" with
 * "this place is booked in the app" and a missing rate with "no price is set
 * for joystick #3, the owner sets it in Branch → Prices" — sentences an
 * operator can act on, which a generic "failed" would throw away.
 */
const SessionOptionsDialog = ({ session, platform, onClose, onChanged, platformName = platformLabel, seat }: Props) => {
  const { t, money, lang } = useLang();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [current, setCurrent] = useState<ISessionApi>(session);
  // WHICH seat this is, as its card says it — the caller's line, else the row's.
  const seatLine = seat ?? sessionSeatLine(current, lang);
  // The venue's one joystick fee, or null when it does not offer extra pads.
  const [fee, setFee] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The structured half of a "seat is taken" refusal, when the last request
   * was one. Null for every other kind of failure, so nothing is offered after
   * an unrelated error.
   */
  const [seatRefusal, setSeatRefusal] = useState<SeatUnavailableBody | null>(null);
  /**
   * The grant that was refused, and the seats the server says could take it.
   *
   * Held together because one is meaningless without the other: moving a
   * player needs to know how long for, and the list is only valid for that
   * length. Cleared on every new attempt so a stale list can never be acted
   * on — and even then the POST re-checks, because a phone can take a seat
   * while this modal is open.
   */
  const [refusedMinutes, setRefusedMinutes] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<IExtensionAlternative[] | null>(null);
  /**
   * The seat the player is on NOW, as the server describes it.
   *
   * Shown opposite the seat being offered, because "move to №6" alone asks a
   * cashier to remember which seat they were looking at — and the whole
   * failure this dialog exists to prevent is moving the wrong player.
   */
  const [moveFrom, setMoveFrom] = useState<IExtensionOptions["current"] | null>(null);
  /** Which seat the cashier has picked. Nothing is sent until one is. */
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  // The grant, by time or by money (2026-11-07, owner): a length in the
  // start dialog's time field ("[1] ч : [30] мин"), or the money the player
  // hands over ("add 700"), which the SERVER turns into minutes.
  const [grantBy, setGrantBy] = useState<"time" | "money">("time");
  const [grant, setGrant] = useState<DurationDraft>(EMPTY_DRAFT);
  const [amountInput, setAmountInput] = useState("");
  // The grant's price typed by hand (2026-10-25), in AMD as `PriceInput` keeps it.
  const [editCharge, setEditCharge] = useState(false);
  const [chargeInput, setChargeInput] = useState("");
  // The gate for the whole unlimited operation. No price is asked (2026-11-15,
  // owner): the seat carries on at the rate it bills at now (`keep_rate`), and
  // the server says the figure once it has switched.
  const [goUnlimited, setGoUnlimited] = useState(false);
  // «⏱ Время» on an unlimited seat (2026-11-07): the length from now.
  const [limitDraft, setLimitDraft] = useState<DurationDraft>(EMPTY_DRAFT);

  /**
   * Joysticks are a PlayStation thing, and the BACKEND decides it.
   *
   * `current.supports_joysticks` is `Platform::isPlayStation()` evaluated
   * server-side against the seat's platform. The `platform` prop — read from
   * the board's device list — is only the fallback, for a backend that does
   * not send the field yet. Deriving it here was a second copy of a server
   * rule, and it failed silently: a stale device list, or a device whose place
   * was not loaded, hid the controls with nothing on screen to say why.
   */
  const seatPlatform = current.place_platform ?? platform ?? null;
  const isPlayStation = current.supports_joysticks ?? platformGroup(seatPlatform ?? "") === "ps";
  const joystickCount = current.joystick_count ?? 1;
  const isUnlimited = current.is_unlimited ?? current.ends_at === null;
  const isFree = current.is_free ?? false;
  const isActive = current.status === "active";
  // The server's state, never a local guess: each flip returns the session.
  const unpaidOn = !!current.unpaid_since;
  // «Оплачено сейчас» (2026-11-15): on a seat paid AHEAD, the grant's charge
  // is paid in cash now and joins the prepayment, so the change at Stop counts
  // it. Off by default: money is recorded in the drawer only when said.
  const prepaidSeat = Number(current.prepaid_amount ?? 0) > 0;
  const [paidNow, setPaidNow] = useState(false);
  const paidNowOn = paidNow && prepaidSeat && !unpaidOn && !(current.is_free ?? false);
  /** …and HOW (2026-11-17): the Stop control; cash preselected and sends nothing. */
  const [paidNowPay, setPaidNowPay] = useState<PaymentDraft>(() => emptyPaymentDraft("cash"));

  // ONE fee for every pad, read from the venue's billing settings. It was a
  // list of per-slot prices and a lookup for "which slot comes next", which
  // could quote a figure for a pad the server was not about to allocate.
  const loadPrices = useCallback(() => {
    if (!isPlayStation) return;
    // A failed read (now also when offline — it no longer falls back) leaves
    // the fee unknown, as before; the server prices the pad either way.
    billingSettingsRepository.get(current.branch_id)
      .then((s) => setFee(s.joystick_price))
      .catch(() => { /* fee stays unknown */ });
  }, [current.branch_id, isPlayStation]);

  useEffect(loadPrices, [loadPrices]);

  /** Run one change, keep the server's answer, and surface its sentence. */
  const grantMinutes = grantBy === "time" ? draftMinutes(grant) : null;
  const amountNum = Number(amountInput);
  const grantAmount = grantBy === "money" && amountInput.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null;
  const paused = !!current.paused_at;
  const canGrant = isActive && !isUnlimited && !paused;
  // The server's price for exactly that length, at THIS session's rate. Only
  // asked of a session that can take time; a refusal shows its reason.
  const chargeNum = Number(chargeInput);
  // 0 is a gift and a legitimate price; empty or negative is not a price.
  const chargeValid = chargeInput.trim() !== "" && Number.isFinite(chargeNum) && chargeNum >= 0;
  const typedCharge = editCharge && chargeValid ? chargeNum : undefined;
  const timeQuote = useServerQuote<ITimeQuote>(
    canGrant && (!editCharge || chargeValid) ? grantMinutes : null,
    (m) => sessionRepository.timeQuote(current.id, m, typedCharge),
    `${current.id}|${current.ends_at ?? ""}|${typedCharge ?? ""}`,
  );
  // By money: the server's minutes and charge for exactly the money typed.
  const moneyQuote = useServerQuote<ITimeQuote>(
    canGrant ? grantAmount : null,
    (a) => sessionRepository.timeQuoteByAmount(current.id, a),
    `${current.id}|${current.ends_at ?? ""}|money`,
  );
  const moneyQuoted = quoteFor(moneyQuote, grantAmount);
  const quoted = quoteFor(timeQuote, grantMinutes);
  // Confirmed only on a quote for exactly what is on screen — the length AND,
  // when typed, the price.
  const quotedCharge = quoted !== null
    && (typedCharge === undefined || Math.round(quoted.charge * 100) === Math.round(typedCharge * 100))
    ? quoted.charge
    : null;
  // What «Оплачено сейчас» pays (2026-11-17): the server's charge for exactly
  // the grant on screen — a split must add up to it.
  const grantCharge = grantBy === "time" ? quotedCharge : moneyQuoted?.charge ?? null;
  const grantChargeCents = grantCharge === null ? null : Math.round(grantCharge * 100);
  const paidNowCheck = checkPayment(grantChargeCents ?? 0, paidNowPay);
  // The seat's Club Card (2026-11-25): «+ Время» may be paid ahead with its bonuses.
  const [bonusCard] = useBoundBonusCard(current.branch_id, current.bonus_account_id);
  const paidNowPayField = prepaidPaymentFields(paidNowPay, paidNowCheck);
  // Cash adds nothing to the call — the request every «Оплачено сейчас» sent before.
  const paidNowPayArgs: [] | [typeof paidNowPayField] = Object.keys(paidNowPayField).length === 0 ? [] : [paidNowPayField];
  // Whether this seat takes a typed price is the server's answer; until it
  // has answered once, the box is not offered.
  const [priceEditable, setPriceEditable] = useState(false);
  useEffect(() => {
    if (timeQuote.status === "ok") setPriceEditable(timeQuote.value.price_editable);
  }, [timeQuote]);

  /**
   * @return true when the server accepted it. Refusals are SHOWN, not thrown —
   * every caller here treats a refusal as "nothing happened", and the manual
   * grant additionally needs to know, so it can keep what the cashier typed
   * instead of clearing the box under a red sentence explaining why it failed.
   */
  /** "1500 ֏/ч": the SERVER's per-hour figure (`hourly_now.total`), never one worked out here. */
  const perHour = (now: ISessionHourlyNow): string => `${money(now.total)}${t("session.perHourShort")}`;
  /**
   * A figure read AGAINST another, to the hundredth (2026-11-15): "1 000" for
   * the hour in all beside "1 002.78" for the hour from now — rounded to whole
   * drams the two would read 1 000 and 1 003, and the difference that decides
   * the choice would be a guess. The revenue screen's rule.
   */
  const exact = (amount: number): string => money(amount, centsWhenFractional(amount));
  const limitMinutes = draftMinutes(limitDraft);
  // «Задать время» (2026-11-15, owner — seat #258: "1 hour" set ten seconds
  // in meant the player sits ONE hour, and an hour at 1000 banked 1100 when it
  // ran from the press). «Всего с начала места» is the default; «Ещё … от
  // сейчас» stays a choice. Both are the SERVER's — end and figure — re-asked
  // each minute, because the end of «from now» moves with the clock.
  const [limitFrom, setLimitFrom] = useState<SessionLimitFrom>("start");
  const limitAsked = isActive && isUnlimited && !paused ? limitMinutes : null;
  const limitTick = useMinuteTick(limitAsked !== null);
  const limitQuote = useServerQuote<ILimitQuote>(
    limitAsked,
    (m) => sessionRepository.limitQuote(current.id, m),
    `${current.id}|limit`,
    limitTick,
  );
  const limitQuoted = quoteFor(limitQuote, limitMinutes);
  const limitChoice: ILimitChoice | null = limitQuoted !== null ? limitQuoted[limitFrom] : null;
  // Confirmed only on an available choice of a quote for exactly this length.
  const limitReady = limitChoice !== null && limitChoice.available;

  /**
   * One sentence for every grant, whichever button produced it.
   *
   * It names the SEAT as well as the minutes: a cashier with two boards open
   * and a queue at the counter needs to know which session just moved, and
   * "+30 min added" alone does not say.
   */
  const timeAddedToast = (minutes: number): string =>
    t("session.timeAddedToast")
      .replace("{0}", String(minutes))
      .replace("{1}", seatLine);

  /**
   * 24-hour wall clock, which is the only format this panel shows a time in.
   * `hour12: false` explicitly — the locale would otherwise decide, and a
   * cashier reading "2:40" cannot tell a reservation at night from one after
   * lunch.
   */
  const clockOf = (at: Date): string =>
    at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  /**
   * What a limit says once the server has written it (2026-11-15): its end
   * and what the seat's time costs in all — «До 19:15: за всё время места
   * 1 000 ֏». An answer without the plan (an older backend) says the end and
   * the per-hour figure, else the length, as before.
   */
  const limitDoneToast = (done: ISessionRateChange | null, minutes: number): string => {
    const plan = done?.limit ?? null;
    const end = plan?.ends_at ?? done?.session.ends_at ?? null;
    if (plan !== null && end !== null) {
      return plan.from === "start"
        ? fmt(t("session.limitDoneStart"), clockOf(new Date(end)), exact(plan.time_total))
        : fmt(t("session.limitDoneNow"), clockOf(new Date(end)), durationLabel(minutes, t), exact(plan.time_total));
    }
    return done?.hourlyNow && end
      ? fmt(t("session.limitDoneRate"), clockOf(new Date(end)), perHour(done.hourlyNow))
      : fmt(t("session.limitDone"), durationLabel(minutes, t));
  };

  const offeredMinutes = offeredMinutesOf(seatRefusal);
  const claimedFrom = claimedFromOf(seatRefusal);

  /**
   * Ask the server for seats that could take the grant this one refused.
   *
   * Failures are swallowed into an empty list on purpose: the cashier already
   * has the refusal in front of them, and a second error line about a
   * suggestion feature would bury it.
   */
  const loadAlternatives = async (sessionId: number, minutes: number): Promise<void> => {
    try {
      const options = await sessionRepository.extensionOptions(sessionId, minutes);
      setAlternatives(options.alternatives);
      setMoveFrom(options.current);
    } catch {
      setAlternatives([]);
      setMoveFrom(null);
    }
  };

  const run = async (
    action: () => Promise<ISessionApi>,
    attemptedMinutes: number | null = null,
    /**
     * Announced ONLY after the server has answered. A toast fired on the click
     * would tell a cashier the time was granted while the request was still in
     * flight — and it is refused often enough (a reservation ahead) that the
     * lie would be a regular one.
     */
    successToast: string | null = null,
    /**
     * Called when the server refused because the SEAT could not take it — the
     * case where the world moved while the dialog was open. Separate from the
     * generic failure path because it is the only one with something specific
     * to say, and saying it is not the same as reporting a fault.
     */
    onSeatRefused: (() => void) | null = null,
  ): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setSeatRefusal(null);
    setAlternatives(null);
    setRefusedMinutes(null);
    setSelectedPlaceId(null);
    try {
      const updated = await action();
      setCurrent(updated);
      onChanged(updated);
      if (successToast !== null) notify.message("success", successToast);
      return true;
    } catch (e) {
      // The seat-is-taken refusal carries the grant the server WOULD accept.
      // Kept beside the sentence so the dialog can offer it as a button
      // instead of leaving the cashier to retry by halving the number.
      const refusal = seatUnavailableBodyOf(e);
      setSeatRefusal(refusal);
      setError(e instanceof Error ? e.message : String(e));

      // …and, when it was a reservation in the way, ask where the player
      // COULD finish. Read-only and advisory — see `apiSessionExtensionOptions`.
      if (refusal !== null && attemptedMinutes !== null) {
        setRefusedMinutes(attemptedMinutes);
        void loadAlternatives(current.id, attemptedMinutes);
      }
      if (refusal !== null) onSeatRefused?.();
      // The refusal is very often "no price is set for joystick #N", and the
      // price list this dialog drew its button from is exactly what has gone
      // stale. Re-reading it is what stops the button advertising a rate the
      // server has just said does not exist.
      loadPrices();
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * What the next pad will cost: the venue's one fee, whichever slot it lands
   * in.
   *
   * This used to resolve the slot the server would allocate and look its price
   * up, because there were three of them — a lookup that could quote a figure
   * for a pad nobody was about to add. One fee makes the question disappear.
   */
  const nextPrice = fee;

  // Whole minutes since the session started, in the same "1 ч 20 мин" shape the
  // receipt uses. Computed from `started_at` rather than ticked, because this
  // dialog is open for seconds at a time and a second timer here would be one
  // more thing that can disagree with the board's.
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(current.started_at).getTime()) / 60_000),
  );
  // What is left until the server's end; null on a seat without one.
  const remainingLabel = current.ends_at === null || isUnlimited
    ? null
    : durationLabel(Math.max(0, Math.ceil((new Date(current.ends_at).getTime() - Date.now()) / 60_000)), t);

  /** «Не оплачено», flipped: the server freezes what was paid at this moment. */
  const switchUnpaid = (on: boolean) => run(
    () => sessionRepository.setUnpaid(current.id, on),
    null,
    fmt(t(on ? "session.unpaid.toastOn" : "session.unpaid.toastOff"), seatLine),
  );

  const elapsedLabel = elapsedMinutes >= 60
    ? `${Math.floor(elapsedMinutes / 60)} ${t("time.hourShort") || "h"} ${elapsedMinutes % 60} ${t("time.minShort") || "min"}`
    : `${elapsedMinutes} ${t("time.minShort") || "min"}`;

  return (
    <Modal open onClose={onClose}>
      {/* `card` is what makes a dialog opaque. Modal itself renders only the
          backdrop and the centring wrapper — every dialog in this app supplies
          its own surface, and this one shipped without it: the panel showed a
          transparent sheet with the board legible straight through it. Same
          class as AddSessionItemDialog and StopReceiptModal, so it inherits the
          design system's surface, radius and border rather than inventing one. */}
      <div className="card col" style={{ gap: 18, width: 460, maxWidth: "92vw" }}>
        {/* «+ Время», one dialog for every mode (2026-11-07, owner); then
            WHICH seat, number and name a size up (2026-11-22, owner). */}
        <h2 className="dialog-title" style={{ margin: 0 }}>
          <span>{t("session.addTime")}</span>
          <span className="dialog-title__seat" data-testid="options-seat" title={seatLine}>{seatLine}</span>
        </h2>

        {/* The two facts an operator needs before deciding anything here: what
            this session is being billed as, and how long it has run. Without
            them "+30 min" is a button pressed on faith. */}
        <div className="row" style={{ gap: 14, flexWrap: "wrap", fontSize: 13 }}>
          <span className="muted">
            {t("session.tariffField")}:{" "}
            <span style={{ color: "var(--color-text)" }}>
              {isUnlimited
                ? t("session.unlimited")
                : current.package_name
                  ?? `${money(Number(current.hourly_rate ?? 0))} / ${t("time.hourShort") || "h"}`}
            </span>
          </span>
          <span className="muted">
            {t("session.elapsedField")}:{" "}
            <span style={{ color: "var(--color-text)" }}>{elapsedLabel}</span>
          </span>
          {/* What is left, on a seat that has an end — the server's end, only
              formatted here. An unlimited seat has none: its mode says so. */}
          <span className="muted" data-testid="options-mode">
            {t("session.modeField")}:{" "}
            <span style={{ color: "var(--color-text)" }}>
              {isUnlimited ? t("session.modeUnlimited") : t("session.modeTimed")}
            </span>
          </span>
          {remainingLabel !== null && (
            <span className="muted" data-testid="options-remaining">
              {t("session.remainingField")}:{" "}
              <span style={{ color: "var(--color-text)" }}>{remainingLabel}</span>
            </span>
          )}
        </div>

        {/* Extra time NOT paid yet (2026-11-07, owner): here and in Start,
            never on the card. Flipped, it is the server's at once — what was
            paid is frozen then — so switch it on BEFORE adding the time the
            player has not paid for; a grant made while it is on carries it as
            well (never "off": a stale dialog must not switch off what another
            desk switched on), so the time it adds is never counted as paid. */}
        {isActive && (
          <div className="col" style={{ gap: 4 }} data-testid="options-unpaid">
            <UnpaidToggle
              on={unpaidOn}
              onChange={(on) => { void switchUnpaid(on); }}
              disabled={busy || isFree}
              label={t("session.unpaid.switch")}
              fullLabel={t("session.unpaid.switchFull")}
            />
            <span className="muted" style={{ fontSize: 12 }}>{t(isFree ? "session.unpaid.freeHint" : "session.unpaid.hint")}</span>
          </div>
        )}

        {!isActive && <div className="error">{t("session.optionsClosedSession")}</div>}
        {error && <div className="error">{error}</div>}

        {/* "You cannot have two hours — you can have fifty minutes."
            A refusal that names no alternative sends the cashier to guess, and
            the figure here comes from the same predicate that just refused, so
            pressing it is a request the guard accepts.

            It is still a normal request: a phone can take the seat between the
            refusal and the press, and being refused a second time is correct
            rather than a bug. */}
        {offeredMinutes !== null && (
          <div className="col" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {claimedFrom
                ? t("session.seatClaimedFrom").replace(
                    "{0}",
                    claimedFrom.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }),
                  )
                : t("session.seatClaimed")}
            </span>
            <div className="row">
              <Button
                variant="secondary"
                disabled={busy || !isActive}
                onClick={() =>
                  void run(
                    () => sessionRepository.addTime(current.id, offeredMinutes, undefined, unpaidOn || undefined),
                    offeredMinutes,
                    timeAddedToast(offeredMinutes),
                  )
                }
              >
                {t("session.addMinutes").replace("{0}", String(offeredMinutes))}
              </Button>
            </div>
          </div>
        )}

        {/* "This seat is taken — finish on one of these."
            The player is at the counter and the seat they are on cannot give
            the time asked for. What follows is the reason, then the seats that
            CAN take it — same venue, same tariff, free for the whole stretch,
            all resolved by the server.

            ⚠️ The list is stale the moment it is drawn. Confirming sends a
            normal request that re-checks under a row lock, and being refused
            (409) is correct rather than a bug: a phone can have taken the seat
            while this was on screen. Nothing here is disabled on the strength
            of the list. */}
        {alternatives !== null && refusedMinutes !== null && (
          <section className="col" style={{ gap: 12 }}>
            {/* The reason, in the operator's words rather than the server's. */}
            <div
              className="col"
              style={{
                gap: 4,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--color-warning)",
                background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
              }}
            >
              <strong>{t("session.moveWhyTitle")}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {claimedFrom
                  ? t("session.moveWhyFrom")
                      .replace("{0}", seatLine)
                      .replace("{1}", clockOf(claimedFrom))
                  : t("session.moveWhy").replace("{0}", seatLine)}
              </span>
            </div>

            <div className="row-between" style={{ alignItems: "baseline" }}>
              <strong>{t("session.moveTitle")}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {t("session.moveRequested").replace("{0}", String(refusedMinutes))}
              </span>
            </div>

            {/* Where the player is, and where they would end up. Two lines with
                an arrow between them, because "move to №6" on its own asks the
                cashier to hold the current seat in their head — and the one
                mistake that matters here is moving the wrong player. */}
            {moveFrom && (
              <div
                className="row"
                style={{ gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}
              >
                <span className="muted">
                  {t("session.moveFromLabel")}{" "}
                  <strong style={{ color: "var(--color-text)" }}>
                    {moveFrom.place_number !== null
                      ? `№${moveFrom.place_number}`
                      : (moveFrom.place_name ?? current.pc_label ?? "-")}
                  </strong>
                </span>
                <span aria-hidden style={{ color: "var(--color-primary)" }}>-&gt;</span>
                <span className="muted">
                  {t("session.moveToLabel")}{" "}
                  <strong style={{ color: "var(--color-text)" }}>
                    {selectedPlaceId === null
                      ? t("session.moveToNothing")
                      : `№${
                          alternatives.find((a) => a.place_id === selectedPlaceId)?.number ??
                          selectedPlaceId
                        }`}
                  </strong>
                </span>
              </div>
            )}

            {alternatives.length === 0 ? (
              <span className="muted" style={{ fontSize: 12 }}>
                {t("session.moveNone")}
              </span>
            ) : (
              <>
                <div className="col" style={{ gap: 8 }}>
                  {alternatives.map((alt) => {
                    const chosen = selectedPlaceId === alt.place_id;
                    return (
                      <button
                        key={alt.place_id}
                        type="button"
                        className="card"
                        aria-pressed={chosen}
                        disabled={busy || !isActive}
                        onClick={() => setSelectedPlaceId(alt.place_id)}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          padding: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          // Selection is a BORDER, not a background: the cards
                          // sit on the modal's own surface and a filled state
                          // would read as disabled next to the buttons below.
                          borderColor: chosen ? "var(--color-primary)" : "var(--color-border)",
                          borderWidth: chosen ? 2 : 1,
                        }}
                      >
                        <span className="col" style={{ gap: 3, minWidth: 0 }}>
                          {/* ⚠️ Number first, and the same `number ?? id` the
                              player sees on their phone. It used to lead with
                              the name, so a cashier reading "VIP corner" had
                              nothing to match against the seat the grid and
                              the phone both call №6. */}
                          <strong>
                            {`№${alt.number ?? alt.place_id}`}
                            {alt.name ? ` · ${alt.name}` : ""}
                          </strong>
                          {/* What KIND of seat it is. Moving a PS player onto a
                              PC is a different session, and the platform was
                              the one thing this card never said. */}
                          <span className="muted" style={{ fontSize: 12 }}>
                            {[alt.platform ? platformName(alt.platform) : null, alt.type]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {t("session.moveFreeFor")
                              .replace("{0}", clockOf(new Date(alt.free_from)))
                              .replace("{1}", clockOf(new Date(alt.free_until)))}
                          </span>
                        </span>
                        <span className="col" style={{ gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
                          <span className="muted">{money(alt.hourly_rate)}</span>
                          {/* A tick, only on the chosen one — the border alone
                              is easy to miss on a busy board. */}
                          <span style={{ color: chosen ? "var(--color-primary)" : "var(--color-success)", fontSize: 12 }}>
                            {chosen ? `✓ ${t("session.moveChosen")}` : t("session.moveAvailable")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <Button
                    variant="primary"
                    disabled={busy || !isActive || selectedPlaceId === null}
                    onClick={() => {
                      const alt = alternatives.find((a) => a.place_id === selectedPlaceId);
                      if (!alt) return;
                      const seatNo = `№${alt.number ?? alt.place_id}`;
                      void run(
                        () => sessionRepository.transferExtension(current.id, alt.place_id, refusedMinutes),
                        refusedMinutes,
                        t("session.movedToast")
                          .replace("{0}", seatNo)
                          .replace("{1}", String(refusedMinutes)),
                        // ⚠️ The seat was free when the list was drawn and is
                        // not now — a phone took it while this modal was open.
                        // The server is what caught it, and this only says so
                        // in words the cashier can act on. Amber, not red:
                        // nothing is broken, they just pick again.
                        () => notify.warning(t("session.moveTakenToast").replace("{0}", seatNo)),
                      );
                    }}
                  >
                    {t("session.moveConfirm")}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Joysticks are managed on the SESSION CARD, not here. This dialog
            used to carry a second set of controls for them: two places to
            press for one thing, and two places to keep in step. The card is
            where a cashier is already looking at the seat, so the card won.
            The pricing, the history and the card's own controls are
            untouched — only this duplicate is gone. */
        }
        {/* Paused: the end moves only on resume (the server refuses it now),
            so nothing about time is offered — «Не оплачено» above still is. */}
        {paused && isActive && (
          <span className="muted" style={{ fontSize: 12 }} data-testid="options-paused">{t("session.timePaused")}</span>
        )}
        {!isUnlimited && !paused && (
          <>
        {/* ── time ──────────────────────────────────────────────────────── */}
        {/* Choose, see the price, confirm (2026-10-25). A preset used to grant
            on the tap; now it fills the length, the SERVER's price for exactly
            that length appears below it, and only the confirm — which names
            both — writes. The grant re-checks everything under its lock, so
            the price is advice and the history row is the record. */}
        <section className="col" style={{ gap: 10 }}>
          <strong>{t("session.addTime")}</strong>
            <>
              {/* By time or by money (2026-11-07): the same grant either way —
                  money is turned into minutes by the server, at this seat. */}
              <SectionTabs
                label={t("session.addTimeBy")}
                value={grantBy}
                disabled={busy || !isActive}
                tabs={[
                  { key: "time", label: t("session.addTimeByTime") },
                  { key: "money", label: t("session.addTimeByMoney") },
                ]}
                onChange={(next) => { setGrantBy(next); setEditCharge(false); setChargeInput(""); }}
              />
              {grantBy === "time" ? (
                <>
                  <DurationInput
                    value={grant}
                    onChange={setGrant}
                    disabled={busy || !isActive}
                    label={t("session.timeAmount")}
                    testId="grant-duration"
                  />
                  <QuotedPrice
                    label={t("session.addTimePrice")}
                    hint={t("session.addTimePriceHint")}
                    quote={timeQuote}
                    amountOf={(q) => q.charge}
                    noteOf={(q) => [
                      q.is_free ? t("session.priceFreeNote") : null,
                      // Typed by hand: what the rate would have asked, so a deal is
                      // visibly a deal.
                      typedCharge !== undefined ? `${t("session.plannedStandard")}: ${money(q.standard_charge)}` : null,
                    ].filter(Boolean).join(" · ") || null}
                  />
                  {/* The price, editable (2026-10-25) on a seat with a plan. What
                      was played is not re-priced; the time still to come shares
                      the rest of the plan plus this figure. */}
                  {(priceEditable || editCharge) && (
                    <>
                      <Checkbox
                        checked={editCharge}
                        onChange={(next) => {
                          setEditCharge(next);
                          setChargeInput(next && quotedCharge !== null ? String(quotedCharge) : "");
                        }}
                        label={t("session.plannedEditTotal")}
                        disabled={busy || !isActive || grantMinutes === null}
                      />
                      {editCharge && (
                        <div className="col" style={{ gap: 4 }} data-testid="grant-charge">
                          <PriceInput label={t("session.addTimePrice")} value={chargeInput} onChange={setChargeInput} />
                          {chargeInput.trim() !== "" && !chargeValid && (
                            <span className="error" style={{ fontSize: 11 }}>{t("session.grantChargeInvalid")}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="col" style={{ gap: 8 }} data-testid="grant-money">
                  <PriceInput label={t("session.addTimeMoney")} value={amountInput} onChange={setAmountInput} />
                  {/* The server's answer for exactly this money: how long it
                      buys, and what will be charged. */}
                  {grantAmount !== null && moneyQuote.status === "error" && (
                    <span className="error" style={{ fontSize: 12 }}>{moneyQuote.message}</span>
                  )}
                  {moneyQuoted && (
                    <div className="grant-money-result" data-testid="grant-money-result" data-minutes={moneyQuoted.minutes}>
                      {fmt(t("session.addTimeMoneyResult"), money(grantAmount ?? 0), durationLabel(moneyQuoted.minutes, t))}
                      {Math.round(moneyQuoted.charge * 100) !== Math.round((grantAmount ?? 0) * 100) && (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {fmt(t("session.addTimeMoneyAtRate"), money(moneyQuoted.charge))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {prepaidSeat && !unpaidOn && !isFree && (
                <UnpaidToggle
                  on={paidNow}
                  onChange={setPaidNow}
                  disabled={busy || !isActive}
                  label={t("session.prepaid.timeSwitch")}
                  fullLabel={t("session.prepaid.timeSwitchFull")}
                  testId="time-prepaid-switch"
                  tone="success"
                />
              )}
              {paidNowOn && grantChargeCents !== null && (
                <PaymentEditor
                  name={`time-prepaid-pay-${current.id}`}
                  branchId={current.branch_id}
                  dueCents={grantChargeCents}
                  value={paidNowPay}
                  onChange={setPaidNowPay}
                  check={paidNowCheck}
                  money={money}
                  disabled={busy || !isActive}
                  bonus={bonusOffer(bonusCard)}
                />
              )}
              {(() => {
                const minutes = grantBy === "time" ? grantMinutes : moneyQuoted?.minutes ?? null;
                return minutes !== null && current.ends_at ? (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {t("session.newEndAt").replace(
                      "{0}",
                      clockOf(new Date(new Date(current.ends_at).getTime() + minutes * 60_000)),
                    )}
                  </span>
                ) : null;
              })()}
              <div>
                {grantBy === "time" ? (
                  <Button
                    disabled={busy || !isActive || grantMinutes === null || quotedCharge === null || (paidNowOn && !paidNowCheck.ok)}
                    onClick={() => {
                      if (grantMinutes === null || quotedCharge === null) return;
                      void run(
                        () => (paidNowOn
                          ? sessionRepository.addTime(current.id, grantMinutes, typedCharge, unpaidOn || undefined, true, ...paidNowPayArgs)
                          : sessionRepository.addTime(current.id, grantMinutes, typedCharge, unpaidOn || undefined)),
                        grantMinutes,
                        timeAddedToast(grantMinutes),
                      ).then((ok) => {
                        if (!ok) return;
                        setGrant(EMPTY_DRAFT);
                        setEditCharge(false);
                        setChargeInput("");
                      });
                    }}
                  >
                    {/* The resolved minutes AND the server's price: "2 hours" and
                        "120 min" are the same grant, and seeing both is what
                        catches a wrong unit before it is sold. */}
                    {t("session.timeAddConfirmPriced")
                      .replace("{0}", `${grantMinutes ?? 0} ${t("time.minShort")}`)
                      .replace("{1}", quotedCharge === null ? "-" : money(quotedCharge))}
                  </Button>
                ) : (
                  <Button
                    disabled={busy || !isActive || grantAmount === null || moneyQuoted === null || (paidNowOn && !paidNowCheck.ok)}
                    data-testid="grant-money-confirm"
                    onClick={() => {
                      if (grantAmount === null || moneyQuoted === null) return;
                      const minutes = moneyQuoted.minutes;
                      void run(
                        () => (paidNowOn
                          ? sessionRepository.addTimeByAmount(current.id, grantAmount, unpaidOn || undefined, true, ...paidNowPayArgs)
                          : sessionRepository.addTimeByAmount(current.id, grantAmount, unpaidOn || undefined)),
                        minutes,
                        timeAddedToast(minutes),
                      ).then((ok) => { if (ok) setAmountInput(""); });
                    }}
                  >
                    {t("session.timeAddConfirmPriced")
                      .replace("{0}", `${moneyQuoted?.minutes ?? 0} ${t("time.minShort")}`)
                      .replace("{1}", moneyQuoted === null ? "-" : money(moneyQuoted.charge))}
                  </Button>
                )}
              </div>
            </>
        </section>

          </>
        )}
        {!isUnlimited && !paused && (
          <>
        {/* ── unlimited ─────────────────────────────────────────────────── */}
        <section className="col" style={{ gap: 8 }} data-testid="unlimited-section">
          <strong>{t("session.unlimited")}</strong>
              {/* The checkbox IS the gate. Nothing about the switch is offered
                  until it is ticked, because removing a seat's end cannot be
                  undone and the form should read as a deliberate act rather
                  than a control sitting there waiting to be clicked. */}
              <Checkbox
                checked={goUnlimited}
                onChange={setGoUnlimited}
                label={t("session.unlimitedGate")}
                disabled={busy || !isActive}
              />

              {/* No price to type (2026-11-15, owner): it carries on at the
                  rate it bills at now, pads and rentals on their own rows as
                  before. The figure is the server's, said once it switched. */}
              {goUnlimited && (
                <span className="options-keep-rate" data-testid="unlimited-keep-rate">{t("session.unlimitedKeepRate")}</span>
              )}

              <div>
                <Button
                  variant="secondary"
                  disabled={busy || !isActive || !goUnlimited}
                  onClick={() => {
                    // Irreversible, so it is confirmed — through the in-app
                    // dialog, never `window.confirm`. A native one poisons the
                    // Electron renderer's keyboard focus on Linux: the next
                    // modal's inputs silently stop accepting keystrokes, and
                    // the cashier's next action is the one that appears broken.
                    //
                    // The refusal path stays the server's: a booked seat or a
                    // seat with no rate is answered with a sentence.
                    void (async () => {
                      if (!(await confirm(t("session.unlimitedConfirm")))) return;
                      let now: ISessionHourlyNow | null = null;
                      const ok = await run(async () => {
                        const r = await sessionRepository.makeUnlimited(current.id);
                        now = r.hourlyNow;
                        return r.session;
                      });
                      if (!ok) return;
                      const kept: ISessionHourlyNow | null = now;
                      notify.message("success", kept !== null
                        ? fmt(t("session.unlimitedDoneKept"), perHour(kept))
                        : t("session.unlimitedDone"));
                    })();
                  }}
                >
                  {t("session.unlimitedApply")}
                </Button>
              </div>
        </section>

          </>
        )}
        {/* ── a fixed time for an unlimited seat (2026-11-07): in all from
            the start, or more from now (2026-11-15) ─────────────────────── */}
        {isUnlimited && !paused && (
          <section className="col" style={{ gap: 10 }} data-testid="limit-section">
              <>
                <span className="muted" style={{ fontSize: 12 }}>{t("session.limitHint")}</span>
                <DurationInput
                  value={limitDraft}
                  onChange={setLimitDraft}
                  disabled={busy || !isActive}
                  label={t("session.limitLength")}
                  testId="limit-duration"
                />
                {limitAsked !== null && limitQuote.status === "error" && (
                  <span className="error" style={{ fontSize: 12 }}>{limitQuote.message}</span>
                )}
                {limitQuoted !== null && (
                  <>
                    <span className="muted" style={{ fontSize: 12 }} data-testid="limit-played">
                      {fmt(t("session.limitPlayed"), durationLabel(Math.floor(limitQuoted.played_seconds / 60), t))}
                    </span>
                    <ChoiceCards<SessionLimitFrom>
                      label={t("session.limitFromLabel")}
                      name={`limit-from-${current.id}`}
                      testId="limit-from"
                      // A choice the server cannot make is never drawn as
                      // chosen: nothing looks picked until the cashier picks.
                      value={limitReady ? limitFrom : null}
                      onChange={setLimitFrom}
                      disabled={busy || !isActive}
                      choices={(["start", "now"] as const).map((key) => {
                        const choice = limitQuoted[key];
                        const title = key === "start"
                          ? t("session.limitFromStart")
                          : fmt(t("session.limitFromNow"), durationLabel(limitMinutes ?? 0, t));
                        return {
                          key,
                          title: choice.available
                            ? `${title} · ${fmt(t("session.limitUntil"), clockOf(new Date(choice.ends_at)))}`
                            : title,
                          // The seat's time in all at that end, or why this
                          // choice cannot be made — both the server's words.
                          detail: choice.available ? fmt(t("session.limitTimeTotal"), exact(choice.time_total)) : choice.message,
                          disabled: !choice.available,
                        };
                      })}
                    />
                  </>
                )}
                <div>
                  <Button
                    data-testid="limit-confirm"
                    disabled={busy || !isActive || limitMinutes === null || !limitReady}
                    onClick={() => {
                      if (limitMinutes === null || !limitReady) return;
                      const from = limitFrom;
                      let answer: ISessionRateChange | null = null;
                      void run(async () => {
                        answer = await sessionRepository.limit(current.id, limitMinutes, from);
                        return answer.session;
                      }).then((ok) => {
                        if (!ok) return;
                        const done: ISessionRateChange | null = answer;
                        notify.message("success", limitDoneToast(done, limitMinutes));
                        onClose();
                      });
                    }}
                  >
                    {fmt(t("session.limitApply"), durationLabel(limitMinutes ?? 0, t))}
                  </Button>
                </div>
              </>
          </section>
        )}

        {/* The reminder a player asked for (2026-11-15): a running seat,
            paused or not, timed or unlimited. */}
        {/* The price per hour, from now (2026-11-19). */}
        {isActive && <HourlyRateSection session={current} disabled={busy} run={run} t={t} money={money} />}
        {isActive && <OutsideFoodRateSection session={current} disabled={busy} run={run} t={t} money={money} />}
        {isActive && <ReminderSection session={current} disabled={busy} run={run} t={t} />}

        {/* Waiving the bill lives on START SESSION, where the decision is
            actually made. Offering it again inside "add time" invited it as
            an afterthought, mid-session, next to a button about minutes —
            and the two have nothing to do with each other. The capability
            and every other entry point are unchanged. */
        }
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          {busy && <Spinner />}
          <Button onClick={onClose}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default SessionOptionsDialog;
