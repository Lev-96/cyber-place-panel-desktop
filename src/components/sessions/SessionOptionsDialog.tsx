import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { IJoystickPrice, MAX_JOYSTICKS } from "@/api/joystickPrices";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useLang } from "@/i18n/LanguageContext";
import { joystickPriceRepository } from "@/repositories/JoystickPriceRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { platformGroup } from "@/utils/platform";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!isPlayStation) return;
    void joystickPriceRepository.listByBranch(current.branch_id).then(setPrices);
  }, [current.branch_id, isPlayStation]);

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
    } finally {
      setBusy(false);
    }
  };

  const priceFor = (slot: number): number | null =>
    prices.find((p) => p.slot === slot)?.price_per_hour ?? null;

  // The pad that would be added next is the (count + 1)-th, and the lowest free
  // slot the server picks is that same number — which is why the price shown
  // here is the price that will be charged.
  const nextSlot = joystickCount + 1;
  const nextPrice = priceFor(nextSlot);

  return (
    <Modal open onClose={onClose}>
      <div className="col" style={{ gap: 18, minWidth: 340, maxWidth: 460 }}>
        <div className="row-between" style={{ alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>{t("session.options")}</h2>
          <span className="muted" style={{ fontSize: 13 }}>{current.pc_label}</span>
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
                {nextPrice !== null && joystickCount < MAX_JOYSTICKS && (
                  <span className="muted" style={{ marginLeft: 6 }}>
                    · {money(nextPrice)}/{t("time.hourShort") || "h"}
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
