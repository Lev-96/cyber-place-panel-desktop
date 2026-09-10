import Button from "@/components/ui/Button";
import JoystickIcon from "@/components/ui/JoystickIcon";
import Checkbox from "@/components/ui/Checkbox";
import Modal from "@/components/ui/Modal";
import Radio from "@/components/ui/Radio";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Spinner from "@/components/ui/Spinner";
import { notify } from "@/ui/notify";
import { MAX_JOYSTICKS } from "@/api/joystickPrices";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useLang } from "@/i18n/LanguageContext";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { platformGroup, platformLabel } from "@/utils/platform";
import { useCallback, useEffect, useState } from "react";
import {
  claimedFromOf,
  offeredMinutesOf,
  seatUnavailableBodyOf,
  type SeatUnavailableBody,
} from "@/api/seatUnavailable";
import type { IExtensionAlternative, IExtensionOptions } from "@/api/sessions";

interface Props {
  session: ISessionApi;
  /** The place's platform, so joysticks are offered only where they mean something. */
  platform?: string | null;
  onClose: () => void;
  /** Called after every successful change with the session the server returned. */
  onChanged: (session: ISessionApi) => void;
}

/**
 * The grants offered as one tap. A list rather than a rule, because these are
 * the lengths venues actually sell — and anything not on it is reachable by
 * typing, so adding one here is a preference, never a capability.
 */
const MINUTE_STEPS = [10, 15, 20, 30, 45, 60, 90, 120] as const;

/**
 * The server's ceiling on a SINGLE grant, mirrored so the form can refuse
 * before a round trip. Past ten hours it is a new session, not an extension —
 * `SessionTimeService::MAX_MINUTES` is where that decision lives and this is
 * only an echo of it: the request is validated there whatever this says.
 */
const MAX_GRANT_MINUTES = 600;

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
const SessionOptionsDialog = ({ session, platform, onClose, onChanged }: Props) => {
  const { t, money } = useLang();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [current, setCurrent] = useState<ISessionApi>(session);
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
  // Manual grant: off by default, so the ordinary case stays one tap.
  const [manual, setManual] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualUnit, setManualUnit] = useState<"minutes" | "hours">("minutes");
  // The price the session carries on at once its end is removed. Off by
  // default: not naming one keeps the tariff's own rate, which is what every
  // switch did before a price could be named at all.
  // The gate for the whole unlimited operation, and the price it will carry on
  // at. `editRate` used to mean "the operator wants to change a price we are
  // already showing"; the price is now always entered deliberately, so the
  // checkbox is the only state the section needs.
  const [goUnlimited, setGoUnlimited] = useState(false);
  const [rateInput, setRateInput] = useState("");

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

  // ONE fee for every pad, read from the venue's billing settings. It was a
  // list of per-slot prices and a lookup for "which slot comes next", which
  // could quote a figure for a pad the server was not about to allocate.
  const loadPrices = useCallback(() => {
    if (!isPlayStation) return;
    void billingSettingsRepository.get(current.branch_id).then((s) => setFee(s.joystick_price));
  }, [current.branch_id, isPlayStation]);

  useEffect(loadPrices, [loadPrices]);

  /** Run one change, keep the server's answer, and surface its sentence. */
  /**
   * The typed grant, in MINUTES — the unit the API speaks.
   *
   * Resolved once and read everywhere, so the number the button offers to add
   * and the number sent are the same by construction. Hours are converted here
   * and nowhere else; `null` means the box does not currently hold a grant that
   * could be sent, which is what disables the button.
   *
   * Whole minutes only. A fractional hour is a legitimate thing to type — 1.5 —
   * and it resolves to 90; a fractional MINUTE is not, and rounding one
   * silently would bill for time nobody granted.
   */
  const manualMinutes = ((): number | null => {
    const raw = manualAmount.trim().replace(",", ".");
    if (raw === "") return null;

    // Only "is this a number at all" here. How SMALL a grant may be is the
    // bound at the bottom of this function and lives there alone — checking it
    // twice means neither check can be proved, because breaking one leaves the
    // other quietly covering for it.
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;

    const minutes = manualUnit === "hours" ? value * 60 : value;
    if (!Number.isInteger(minutes)) return null;

    return minutes >= 1 && minutes <= MAX_GRANT_MINUTES ? minutes : null;
  })();

  /**
   * @return true when the server accepted it. Refusals are SHOWN, not thrown —
   * every caller here treats a refusal as "nothing happened", and the manual
   * grant additionally needs to know, so it can keep what the cashier typed
   * instead of clearing the box under a red sentence explaining why it failed.
   */
  /**
   * The rate to send, or null when the box does not hold a usable one.
   *
   * `undefined` from the caller's point of view — "no rate named" — is the
   * unedited case and is handled at the call site; this only answers whether
   * what was TYPED is a price. Zero is refused here as it is on the server:
   * a free session is a different decision with its own capability.
   */
  const typedRate = ((): number | null => {
    const raw = rateInput.trim().replace(",", ".");
    if (raw === "") return null;

    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  })();

  /**
   * What the session would carry on at, as the SERVER resolves it.
   *
   * Never `hourly_rate ?? 0`: a fixed session's column is null by design, and
   * that fallback is exactly how a 1500/hour tariff came to be offered as
   * "0 драм/ч". `null` here means the server could derive no rate either — it
   * will refuse the switch, so the dialog says so rather than inviting a click
   * that cannot work.
   */
  const resolvedRate = current.tariff_hourly_rate ?? null;

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
      .replace("{1}", current.pc_label ?? "");

  /**
   * 24-hour wall clock, which is the only format this panel shows a time in.
   * `hour12: false` explicitly — the locale would otherwise decide, and a
   * cashier reading "2:40" cannot tell a reservation at night from one after
   * lunch.
   */
  const clockOf = (at: Date): string =>
    at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

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
        <div className="row-between" style={{ alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>{t("session.options")}</h2>
          <span className="muted" style={{ fontSize: 13 }}>{current.pc_label}</span>
        </div>

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
        </div>

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
                    () => sessionRepository.addTime(current.id, offeredMinutes),
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
                      .replace("{0}", current.pc_label ?? "")
                      .replace("{1}", clockOf(claimedFrom))
                  : t("session.moveWhy").replace("{0}", current.pc_label ?? "")}
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
                            {[alt.platform ? platformLabel(alt.platform) : null, alt.type]
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
        {/* ── time ──────────────────────────────────────────────────────── */}
        <section className="col" style={{ gap: 8 }}>
          <strong>{t("session.addTime")}</strong>
          {isUnlimited ? (
            <span className="muted" style={{ fontSize: 12 }}>{t("session.timeNotApplicable")}</span>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {MINUTE_STEPS.map((m) => (
                <Button
                  key={m}
                  variant="secondary"
                  disabled={busy || !isActive}
                  onClick={() =>
                    void run(
                      () => sessionRepository.addTime(current.id, m),
                      m,
                      timeAddedToast(m),
                    )
                  }
                >
                  {t("session.addMinutes").replace("{0}", String(m))}
                </Button>
              ))}
            </div>
          )}

          {/* The grant no preset covers. Reuses the dialog's own primitives —
              nothing here is a new control. */}
          {!isUnlimited && (
            <div className="col" style={{ gap: 6 }}>
              <Checkbox
                checked={manual}
                onChange={(next) => { setManual(next); setManualAmount(""); }}
                label={t("session.timeManual")}
                disabled={busy || !isActive}
              />
              {manual && (
                <div className="col" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/* Text + `inputMode`, which is the mechanism
                        `NumberStepper` itself uses — Electron swallows
                        keystrokes in a raw `type="number"`, on one of the two
                        boxes a cashier types into with a player waiting.
                        `NumberStepper` is not used directly because it holds a
                        NUMBER and this field is deliberately a string: empty is
                        "not filled in yet" rather than zero, and the validation
                        below depends on telling those apart. */}
                    <input
                      className="input"
                      type="text"
                      inputMode="decimal"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      aria-label={t("session.timeAmount")}
                      style={{ width: 110 }}
                      autoFocus
                    />
                    {/* The app's own radio, not the native control — which
                        renders washed-out against this dark UI and was the one
                        place it had survived. Same 18px mark as the Checkbox
                        above, so the two line up on one baseline. */}
                    {(["minutes", "hours"] as const).map((unit) => (
                      <Radio
                        key={unit}
                        name="cp-time-unit"
                        checked={manualUnit === unit}
                        onChange={() => setManualUnit(unit)}
                        disabled={busy || !isActive}
                        label={t(unit === "hours" ? "session.timeUnitHours" : "session.timeUnitMinutes")}
                      />
                    ))}
                  </div>
                  {/* Only once something has been typed: an empty box is not a
                      mistake yet, and shouting at one is how a form teaches an
                      operator to ignore it. */}
                  {manualAmount.trim() !== "" && manualMinutes === null && (
                    <span className="error" style={{ fontSize: 12 }}>{t("session.timeInvalid")}</span>
                  )}
                  <div>
                    <Button
                      disabled={busy || !isActive || manualMinutes === null}
                      onClick={() => {
                        if (manualMinutes === null) return;
                        void run(
                          () => sessionRepository.addTime(current.id, manualMinutes),
                          manualMinutes,
                          timeAddedToast(manualMinutes),
                        )
                          // Only on success. A refused grant keeps the box as
                          // it was, beside the sentence saying why.
                          .then((ok) => { if (ok) { setManualAmount(""); setManual(false); } });
                      }}
                    >
                      {/* The resolved TOTAL, not what was typed: "2 hours" and
                          "Add 120 min" are the same grant, and seeing the second
                          is what catches a wrong unit before it is sold. */}
                      {t("session.timeAddConfirm").replace("{0}", String(manualMinutes ?? 0))}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── unlimited ─────────────────────────────────────────────────── */}
        <section className="col" style={{ gap: 8 }}>
          <strong>{t("session.unlimited")}</strong>

          {isUnlimited ? (
            <span className="muted" style={{ fontSize: 12 }}>{t("session.unlimitedAlready")}</span>
          ) : (
            <>
              {/* The checkbox IS the gate. Nothing about the switch is offered
                  until it is ticked — not the price, not the button — because
                  removing a seat's end cannot be undone and the form should
                  read as a deliberate act rather than a control sitting there
                  waiting to be clicked. */}
              <Checkbox
                checked={goUnlimited}
                onChange={(next) => {
                  setGoUnlimited(next);
                  // Prefilled from the seat when opening an EMPTY box, and left
                  // alone otherwise: unticking must not throw away a price the
                  // operator typed, and re-ticking should give it back rather
                  // than make them type it twice.
                  //
                  // Which also makes the gate a rule of its own rather than one
                  // that only holds because the box happens to be empty — with
                  // a price still in state, an unticked gate must STILL keep
                  // the switch shut, and that is now observable.
                  if (next && rateInput.trim() === "" && resolvedRate) setRateInput(String(resolvedRate));
                }}
                label={t("session.unlimitedGate")}
                disabled={busy || !isActive}
              />

              {goUnlimited && (
                <div className="col" style={{ gap: 6, paddingLeft: 26 }}>
                  <span className="muted" style={{ fontSize: 12 }}>{t("session.unlimitedHint")}</span>

                  {/* Required, and asked for rather than assumed. A seat with
                      no configured price used to be answered with "check the
                      tariff settings", which tells an operator holding a player
                      to go and edit a settings screen. The price the session
                      carries on at is a decision they can make here — it is
                      prefilled from the seat when there is one, and typed when
                      there is not. The server validates it either way. */}
                  <label className="col" style={{ gap: 4 }}>
                    <span className="label">{t("session.unlimitedRate")} *</span>
                    <div className="row" style={{ gap: 6, alignItems: "center" }}>
                      {/* Same reason as the amount box above. */}
                      <input
                        className="input"
                        type="text"
                        inputMode="decimal"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        aria-label={t("session.unlimitedRate")}
                        style={{ width: 140 }}
                        autoFocus
                      />
                      <span className="muted" style={{ fontSize: 12 }}>/ {t("time.hourShort") || "h"}</span>
                    </div>
                  </label>

                  {/* Only once something has been typed: an empty box is not a
                      mistake yet, and shouting at one teaches an operator to
                      ignore the message that matters. */}
                  {rateInput.trim() !== "" && typedRate === null && (
                    <span className="error" style={{ fontSize: 12 }}>{t("session.unlimitedRateInvalid")}</span>
                  )}
                  <span className="muted" style={{ fontSize: 12 }}>{t("session.unlimitedRateHint")}</span>
                </div>
              )}

              <div>
                <Button
                  variant="secondary"
                  // Ticked AND priced, or nothing. The server refuses a
                  // non-price too; this only keeps the operator from earning
                  // a 422 they would have to read.
                  disabled={busy || !isActive || !goUnlimited || typedRate === null}
                  onClick={() => {
                    // Irreversible, so it is confirmed — through the in-app
                    // dialog, never `window.confirm`. A native one poisons the
                    // Electron renderer's keyboard focus on Linux: the next
                    // modal's inputs silently stop accepting keystrokes, and
                    // the cashier's next action is the one that appears broken.
                    //
                    // The refusal path stays the server's: a booked seat is
                    // answered with a sentence, not a disabled button, because
                    // only the server knows.
                    void (async () => {
                      if (typedRate === null) return;
                      if (!(await confirm(t("session.unlimitedConfirm")))) return;
                      await run(() => sessionRepository.makeUnlimited(current.id, typedRate));
                    })();
                  }}
                >
                  {t("session.unlimitedApply")}
                </Button>
              </div>
            </>
          )}
        </section>

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
