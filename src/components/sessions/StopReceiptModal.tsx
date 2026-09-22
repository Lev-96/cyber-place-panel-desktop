import { SkeletonText } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { PaymentMethod } from "@/api/sessions";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { IBillBreakdown } from "@/api/sessions";
import { useLang } from "@/i18n/LanguageContext";
import { sharedPrecision } from "@/i18n/currency";
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
  // Cash by default: it is the common case at a counter, so the ordinary stop
  // stays one click rather than two.
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [other, setOther] = useState("");
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
    // ⚠️ Checked here so the cashier is told BEFORE the request, but the server
    // enforces the same rule and is what actually decides — this is a courtesy,
    // not the guard. A stop refused for a missing note leaves the seat running.
    if (method === "other" && other.trim() === "") {
      setErr(t("session.payOtherRequired"));
      return;
    }

    setBusy(true); setErr(null);
    try {
      const r = await sessionRepository.stop(session.id, {
        payment_method: method,
        // Sent only for `other`: the server strips it for the other two, and a
        // card payment carrying a note called "Idram" is a contradiction the
        // history would then have to display.
        ...(method === "other" ? { payment_method_other: other.trim() } : {}),
      });
      setStopped(r.breakdown);
      onConfirmed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to stop");
      setBusy(false);
    }
  };

  const view = stopped ?? bill;

  // ONE precision decision for the whole receipt, taken from every figure on
  // it. Deciding per figure printed "4.72", "500" and "505" on the same bill:
  // the first is under the per-figure threshold and the other two are over it,
  // so the column stopped adding up. A receipt is read as a column.
  const receiptPrecision = view === null ? undefined : sharedPrecision([
    Number(view.time_cost),
    Number(view.total),
    ...(view.joysticks ?? []).map((j) => Number(j.amount)),
    ...view.items.map((it) => Number(it.line_total)),
  ]);


  /**
   * How the money is being taken.
   *
   * Radio rather than checkboxes: it is one answer, and a set of checkboxes
   * invites two. Cash leads because it is the common case at a counter, and a
   * default means the ordinary stop stays one click.
   */
  const methods: { key: PaymentMethod; label: string }[] = [
    { key: "cash", label: t("session.payCash") },
    { key: "card", label: t("session.payCard") },
    { key: "other", label: t("session.payOther") },
  ];

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
                      {money(Number(view.hourly_rate), receiptPrecision)}/{t("time.hourShort") || "h"}
                    </span>
                  )}
                  {/* Arithmetic, not a typed price: a short session at twelve an
                      hour is a third of a unit, and "0" reads as "nothing was
                      charged". */}
                  <span style={{ fontWeight: 700 }}>
                    {money(Number(view.time_cost), receiptPrecision)}
                  </span>
                </>
              )}
            </div>

            {/* Joysticks — one line per USE, because that is what is charged.
                A pad's fee goes on the bill when it is handed out and comes off
                when it is handed back, so a line is either the whole fee or a
                plain 0, never a fraction. The 0 lines are the reason this
                section exists at all: without them a cashier sees a pad that
                was in play and no charge for it, and has to guess whether the
                till lost it.

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
                  {!j.is_charged && ` · ${t("session.joystickReturned")}`}
                </span>
                {/* The same precision rule as the total below, deliberately.
                    This line used to round to whole units while the time cost
                    and the total printed cents, so a receipt read "21.94 + 1 =
                    23.05" — three figures that do not add up, on the one screen
                    a cashier checks with their eyes. Under the hourly strategy
                    a pad's share of a short session is normally a fraction, so
                    it was not an edge case; it was every receipt. */}
                <span style={{ fontWeight: 700 }}>
                  {money(Number(j.amount), receiptPrecision)}
                </span>
              </div>
            ))}

            {/* Items */}
            {view.items.map((it) => (
              <div key={it.id} style={row}>
                <span style={{ flex: 1 }}>{it.name}{it.qty > 1 ? ` × ${it.qty}` : ""}</span>
                {/* An HOURLY line is a rate and a duration, so it reads like a
                    pad's line rather than like a drink's: "90 m · 700/h", and
                    "returned" once its clock has stopped. Printing "700 × 1"
                    beside an amount of 1 050 is three figures that do not add
                    up, on the one screen a cashier checks with their eyes. */}
                <span className="muted" style={{ marginRight: 12, fontSize: 12 }}>
                  {it.is_hourly
                    ? `${it.minutes ?? 0} ${t("time.minShort") || "m"} · ${money(Number(it.price), receiptPrecision)}${t("session.extraPerHour")}${it.qty > 1 ? ` × ${it.qty}` : ""}${it.returned_at ? ` · ${t("session.extraReturned")}` : ""}`
                    : `${money(Number(it.price), receiptPrecision)}${it.qty > 1 ? ` × ${it.qty}` : ""}`}
                </span>
                <span style={{ fontWeight: 700, marginRight: 8 }}>
                  {money(Number(it.line_total), receiptPrecision)}
                </span>
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
                  : money(Number(view.total), receiptPrecision)}
              </span>
            </div>
          </div>
        )}

        {/* ⚠️ Hidden once the session is finished: the choice has been made and
            the receipt above is the record of it. A live radio group under a
            closed bill invites an edit that nothing would accept. */}
        {!finished && (
          <div className="col" style={{ gap: 6, marginTop: 6 }}>
            <strong style={{ fontSize: 13 }}>{t("session.payTitle")}</strong>
            <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
              {methods.map((m) => (
                <label
                  key={m.key}
                  className="row"
                  style={{ gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}
                >
                  <input
                    type="radio"
                    name={`pay-${session.id}`}
                    value={m.key}
                    checked={method === m.key}
                    disabled={busy}
                    onChange={() => { setMethod(m.key); setErr(null); }}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            {method === "other" && (
              <Input
                value={other}
                onChange={(e) => { setOther(e.target.value); setErr(null); }}
                placeholder={t("session.payOtherPlaceholder")}
                disabled={busy}
              />
            )}
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
