import { SkeletonText } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { IBillBreakdown } from "@/api/sessions";
import { useLang } from "@/i18n/LanguageContext";
import { preciseWhenSmall } from "@/i18n/currency";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { useEffect, useState } from "react";

interface Props {
  session: ISessionApi;
  onClose: () => void;
  onConfirmed: () => void;
  onItemRemoved: () => void;
}

const fmtDuration = (mins: number, t: (k: string) => string) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  // Suffixes flow through the same i18n keys SessionsBoard / SessionsHistory
  // use, so swapping the language never leaves a stray Russian "ч" behind.
  const hShort = t("time.hourShort") || "h";
  const mShort = t("time.minShort") || "min";
  return h > 0 ? `${h} ${hShort} ${m} ${mShort}` : `${m} ${mShort}`;
};

/**
 * Pre-stop receipt: hits /preview to get backend-computed breakdown (single
 * source of truth — same calculator used by /stop), shows time + items, lets
 * cashier remove items, then confirms stop.
 */
const StopReceiptModal = ({ session, onClose, onConfirmed, onItemRemoved }: Props) => {
  const { money, t } = useLang();
  const [bill, setBill] = useState<IBillBreakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stopped, setStopped] = useState<IBillBreakdown | null>(null);

  const reload = async () => {
    try {
      const preview = await sessionRepository.preview(session.id);
      setBill(preview);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    void reload();
    // Refresh time-cost every 5s while modal open (open sessions keep ticking).
    // A seat that is already over has a final figure, so it is read once —
    // re-asking would return the same number every five seconds for as long as
    // the cashier leaves the receipt on screen.
    if (session.status !== "active") return;
    const timer = setInterval(() => { void reload(); }, 5_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const remove = async (itemId: number) => {
    setBusy(true);
    try {
      await sessionRepository.removeItem(session.id, itemId);
      onItemRemoved();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to remove");
    } finally { setBusy(false); }
  };

  const confirmStop = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await sessionRepository.stop(session.id);
      setStopped(r.breakdown);
      onConfirmed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to stop");
      setBusy(false);
    }
  };

  const view = stopped ?? bill;

  /**
   * The seat is already over — its paid period ran out and the server ended it,
   * or another desk stopped it while this one was looking.
   *
   * The modal then reports rather than asks: no Confirm, no per-line remove,
   * and the heading says the checkout is done. `preview` still supplies the
   * figures and they are the FINAL ones — the backend prices a closed session
   * at its `stopped_at`, never at now, so a receipt opened two hours later
   * shows what was banked and not two hours of extra clock.
   */
  const endedWithoutUs = session.status !== "active";
  const finished = stopped !== null || endedWithoutUs;

  const deviceLabel = session.pc_label ?? `№${session.pc_id}`;

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 520, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          {finished ? t("session.checkoutDone") : `${t("session.checkoutTitle")} · ${deviceLabel}`}
        </h2>

        {!view ? <SkeletonText lines={5} /> : (
          <div className="col" style={{ gap: 0 }}>
            {/* Time line */}
            <div style={row}>
              <span style={{ flex: 1 }}>
                {view.mode === "open"
                  ? `${t("session.timePlayed")}: ${fmtDuration(view.elapsed_minutes, t)}`
                  : `${t("session.tariff")} · ${view.package_name ?? ""}`}
              </span>
              {/* Both figures are hidden on a waived bill, and `is_free` is the
                  only thing that decides it — never `total === 0`, which is
                  also true of a session that ran for zero minutes.

                  The rate and the time cost are what the clock WOULD have
                  earned. On a receipt nobody is paying they are a price quoted
                  next to "Бесплатная сессия", and a cashier reading a rate
                  above a waiver has to work out which of the two is the truth.
                  The played time above stays: it is a fact about the seat, not
                  a charge. */}
              {!view.is_free && (
                <>
                  {view.mode === "open" && view.hourly_rate != null && (
                    <span className="muted" style={{ marginRight: 12, fontSize: 12 }}>
                      {money(Number(view.hourly_rate))}/{t("time.hourShort") || "h"}
                    </span>
                  )}
                  {/* Arithmetic, not a typed price: a short session at twelve an
                      hour is a third of a unit, and "0" reads as "nothing was
                      charged". */}
                  <span style={{ fontWeight: 700 }}>
                    {money(Number(view.time_cost), preciseWhenSmall(Number(view.time_cost)))}
                  </span>
                </>
              )}
            </div>

            {/* Joysticks — one line per USE, because that is what is charged.
                A pad is a flat fee owed once its period passed the threshold,
                so a line is either the whole fee or a plain 0, never a
                fraction. The 0 lines are the reason this section exists at
                all: without them a cashier sees a pad that was in play and no
                charge for it, and has to guess whether the till lost it.

                The server decides every figure here. Nothing on this side
                multiplies, divides or sums a pad's price — `amount` is read as
                given, and `joysticks_total` is the server's own sum. */}
            {!view.is_free && (view.joysticks ?? []).map((j) => (
              <div key={j.id} style={row}>
                <span style={{ flex: 1 }}>
                  {t("session.joystickSlot").replace("{0}", String(j.slot))}
                </span>
                <span className="muted" style={{ marginRight: 12, fontSize: 12 }}>
                  {j.minutes} {t("time.minShort") || "m"}
                  {!j.is_charged && ` · ${t("session.joystickUnderThreshold")}`}
                </span>
                <span style={{ fontWeight: 700 }}>{money(Number(j.amount))}</span>
              </div>
            ))}

            {/* Items */}
            {view.items.map((it) => (
              <div key={it.id} style={row}>
                <span style={{ flex: 1 }}>{it.name}{it.qty > 1 ? ` × ${it.qty}` : ""}</span>
                <span className="muted" style={{ marginRight: 12, fontSize: 12 }}>
                  {money(Number(it.price))}{it.qty > 1 ? ` × ${it.qty}` : ""}
                </span>
                <span style={{ fontWeight: 700, marginRight: 8 }}>{money(Number(it.line_total))}</span>
                {!finished && (
                  <button type="button" onClick={() => remove(it.id)} disabled={busy} style={removeBtn} title={t("session.removeItemTitle")}>
                    ×
                  </button>
                )}
              </div>
            ))}

            {/* Total */}
            <div style={{ ...row, borderTop: "2px solid #07ddf1", marginTop: 6, paddingTop: 12 }}>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{t("session.totalDue")}</span>
              {/* A waived bill says so in words. A correct 0 here is exactly
                  what an operator double-checks — it reads as "the till
                  failed" rather than "somebody decided this". What was given
                  away is still on the row and in the audit log; this receipt
                  is what the player is being handed, and it owes them one
                  number. */}
              <span style={{ fontWeight: 800, fontSize: 18, color: "#07ddf1" }}>
                {view.is_free
                  ? t("session.freeBill")
                  : money(Number(view.total), preciseWhenSmall(Number(view.total)))}
              </span>
            </div>
          </div>
        )}

        {err && <div className="error">{err}</div>}

        <div className="row-between" style={{ marginTop: 4 }}>
          {finished ? (
            <Button onClick={onClose}>{t("action.close")}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
              <Button onClick={confirmStop} disabled={busy || !bill}>
                {busy ? t("session.closing") : t("session.confirmStop")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

const row: React.CSSProperties = {
  display: "flex", alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid #131c33",
};

const removeBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 11,
  border: "1px solid #4a1a1a", background: "transparent",
  color: "#ef4444", cursor: "pointer", fontSize: 14, lineHeight: 1,
};

export default StopReceiptModal;
