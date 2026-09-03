import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { IJoystickPrice, JOYSTICK_SLOTS, MAX_JOYSTICKS } from "@/api/joystickPrices";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useLang } from "@/i18n/LanguageContext";
import { joystickPriceRepository } from "@/repositories/JoystickPriceRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { platformGroup } from "@/utils/platform";
import { useCallback, useEffect, useState } from "react";

interface Props {
  session: ISessionApi;
  /** The place's platform, so joysticks are offered only where they mean something. */
  platform?: string | null;
  onClose: () => void;
  /** Called after every successful change with the session the server returned. */
  onChanged: (session: ISessionApi) => void;
}

/** The grants the panel offers. A venue that wants +45 gets it from the API. */
const MINUTE_STEPS = [10, 30, 60] as const;

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
  const [current, setCurrent] = useState<ISessionApi>(session);
  const [prices, setPrices] = useState<IJoystickPrice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Joysticks are a PlayStation thing. `pcs.kind === "ps"` is NOT that
  // question — it means "no kiosk agent" and is equally true of a ping-pong
  // table — so this asks the place's platform, exactly as the backend does.
  const isPlayStation = platformGroup(platform ?? "") === "ps";
  const joystickCount = current.joystick_count ?? 1;
  const isUnlimited = current.is_unlimited ?? current.ends_at === null;
  const isFree = current.is_free ?? false;
  const isActive = current.status === "active";

  const loadPrices = useCallback(() => {
    if (!isPlayStation) return;
    void joystickPriceRepository.listByBranch(current.branch_id).then(setPrices);
  }, [current.branch_id, isPlayStation]);

  useEffect(loadPrices, [loadPrices]);

  /** Run one change, keep the server's answer, and surface its sentence. */
  const run = async (action: () => Promise<ISessionApi>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setCurrent(updated);
      onChanged(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // The refusal is very often "no price is set for joystick #N", and the
      // price list this dialog drew its button from is exactly what has gone
      // stale. Re-reading it is what stops the button advertising a rate the
      // server has just said does not exist.
      loadPrices();
    } finally {
      setBusy(false);
    }
  };

  const priceFor = (slot: number): number | null =>
    prices.find((p) => p.slot === slot)?.price_per_hour ?? null;

  /**
   * The slot the server will actually allocate: the LOWEST free one, exactly as
   * `JoystickService::add()` picks it.
   *
   * This was `joystickCount + 1`, which is the same number right up until a pad
   * is removed from the middle. With slots 2 and 4 in play the count is 3, so
   * the old sum said "next is 4" and quoted slot 4's rate — while the server
   * would allocate slot 3. The button advertised a price for a pad nobody was
   * about to add, and on a venue that had not priced slot 3 it advertised a
   * price and then refused.
   */
  const openSlots = (current.joysticks ?? []).filter((j) => j.stopped_at === null).map((j) => j.slot);
  const nextSlot = current.joysticks
    ? JOYSTICK_SLOTS.find((slot) => !openSlots.includes(slot)) ?? null
    // No interval rows to reason from — an older backend, or a session
    // returned without the relation. The count is then the only thing known,
    // and it is right in every case except a pad removed from the middle.
    : (JOYSTICK_SLOTS.find((slot) => slot === joystickCount + 1) ?? null);
  const nextPrice = nextSlot === null ? null : priceFor(nextSlot);

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

        {/* ── joysticks ─────────────────────────────────────────────────── */}
        {isPlayStation ? (
          <section className="col" style={{ gap: 8 }}>
            <div className="row-between" style={{ alignItems: "baseline" }}>
              <strong>{t("session.joysticks")}</strong>
              <span style={{ fontSize: 18, letterSpacing: 2 }} aria-label={`${joystickCount}`}>
                {"🎮".repeat(joystickCount)}
                <span className="muted" style={{ fontSize: 13, letterSpacing: 0, marginLeft: 6 }}>
                  {joystickCount} / {MAX_JOYSTICKS}
                </span>
              </span>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{t("session.joystickBilledFrom")}</span>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Button
                variant="secondary"
                disabled={busy || !isActive || joystickCount >= MAX_JOYSTICKS}
                title={joystickCount >= MAX_JOYSTICKS ? t("session.joystickMax") : undefined}
                onClick={() => void run(() => sessionRepository.addJoystick(current.id))}
              >
                {t("session.joystickAdd")}
                {joystickCount < MAX_JOYSTICKS && (
                  <span className="muted" style={{ marginLeft: 6 }}>
                    {/* An unpriced slot says so instead of showing a number.
                        The button stays clickable on purpose — the server is
                        the authority on whether a pad may be added, and its
                        refusal names the slot and where to fix it. A disabled
                        button would say "no" without saying why. */}
                    · {nextPrice !== null
                        ? `${money(nextPrice)}/${t("time.hourShort") || "h"}`
                        : t("session.joystickNoPrice")}
                  </span>
                )}
              </Button>
            </div>

            {/* One row per pad in play, so removing one is unambiguous: the
                cashier takes out the third, not "the last". */}
            <div className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 12 }}>{t("session.joystickIncluded")}</span>
              {(current.joysticks ?? [])
                .filter((j) => j.stopped_at === null)
                .sort((a, b) => a.slot - b.slot)
                .map((j) => (
                  <div key={j.id} className="row-between" style={{ fontSize: 13 }}>
                    <span>
                      {t("session.joystickSlot").replace("{0}", String(j.slot))}
                      <span className="muted"> · {money(j.hourly_rate)}/{t("time.hourShort") || "h"}</span>
                    </span>
                    <Button
                      variant="secondary"
                      disabled={busy || !isActive}
                      style={{ padding: "2px 8px", fontSize: 12 }}
                      onClick={() => void run(() => sessionRepository.removeJoystick(current.id, j.slot))}
                    >
                      {t("session.joystickRemove").replace("{0}", String(j.slot))}
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>{t("session.joystickPsOnly")}</span>
        )}

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
                  onClick={() => void run(() => sessionRepository.addTime(current.id, m))}
                >
                  {t("session.addMinutes").replace("{0}", String(m))}
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* ── unlimited ─────────────────────────────────────────────────── */}
        <section className="col" style={{ gap: 6 }}>
          <strong>{t("session.unlimited")}</strong>
          <span className="muted" style={{ fontSize: 12 }}>{t("session.unlimitedHint")}</span>
          <div>
            <Button
              variant="secondary"
              disabled={busy || !isActive || isUnlimited}
              onClick={() => {
                // Irreversible, so it is confirmed. The refusal path is the
                // server's — a booked seat is answered with a sentence, not
                // with a disabled button, because only the server knows.
                if (!confirm(t("session.unlimitedConfirm"))) return;
                void run(() => sessionRepository.makeUnlimited(current.id));
              }}
            >
              {isUnlimited ? t("session.unlimited") : t("session.makeUnlimited")}
            </Button>
          </div>
        </section>

        {/* ── free ──────────────────────────────────────────────────────── */}
        {can(user?.role, "session.free") && (
          <section className="col" style={{ gap: 6 }}>
            <label className="row" style={{ gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isFree}
                disabled={busy || !isActive}
                onChange={(e) => void run(() => sessionRepository.setFree(current.id, e.target.checked))}
              />
              <strong>{t("session.freeBill")}</strong>
            </label>
            <span className="muted" style={{ fontSize: 12 }}>{t("session.freeBillHint")}</span>
          </section>
        )}

        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          {busy && <Spinner />}
          <Button onClick={onClose}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default SessionOptionsDialog;
