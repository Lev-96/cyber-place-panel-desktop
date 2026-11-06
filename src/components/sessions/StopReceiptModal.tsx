import { SkeletonText } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import type { PaymentMethod } from "@/api/sessions";
import Modal from "@/components/ui/Modal";
import PaymentMethodPicker, { paymentNoteMissing } from "@/components/payments/PaymentMethodPicker";
import Spinner from "@/components/ui/Spinner";
import { IBillBreakdown } from "@/api/sessions";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { notify } from "@/ui/notify";
import { sharedPrecision } from "@/i18n/currency";
import { toAmount } from "@/shifts/cash";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { useEffect, useRef, useState } from "react";
import { RESET_MIN_AMOUNT } from "./sessionAmount";
import CashChangePanel from "@/components/payments/CashChangePanel";
import { billCents, cashChange } from "@/components/payments/cashChange";
import type { ICashHandover } from "@/api/sessions";

interface Props {
  session: ISessionApi;
  onClose: () => void;
  /** The seat is over on the server — stopped, or cancelled (2026-11-06). */
  onConfirmed: (outcome?: { cancelled: boolean }) => void;
  onItemRemoved: () => void;
  /**
   * Whether this person may reset the counter from the receipt (2026-11-05,
   * `session.free` — the server checks it again). Absent: not offered.
   */
  canResetTime?: boolean;
  /** The bill changed here (the counter was reset): the board reads again. */
  onTimeReset?: () => void;
  /**
   * Whether this person may cancel the seat from the receipt (2026-11-06,
   * `session.free` — the server checks it again). Absent: not offered.
   */
  canCancel?: boolean;
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
const StopReceiptModal = ({ session, onClose, onConfirmed, onItemRemoved, canResetTime = false, onTimeReset, canCancel = false }: Props) => {
  const { money, t } = useLang();
  const ask = useConfirm();
  const [bill, setBill] = useState<IBillBreakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Cash by default: it is the common case at a counter, so the ordinary stop
  // stays one click rather than two.
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [other, setOther] = useState("");
  const [stopped, setStopped] = useState<IBillBreakdown | null>(null);
  // Cash only: the banknotes handed over, for the change. Cleared on every
  // method switch, so an amount typed for cash never rides along with card.
  const [received, setReceived] = useState("");
  const [handover, setHandover] = useState<ICashHandover | null>(null);
  /** Synchronous guard: a double click arrives before `busy` re-renders. */
  const stoppingNow = useRef(false);

  const reload = async () => {
    try {
      const preview = await sessionRepository.preview(session.id);
      setBill(preview);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  };

  // Read ONCE, when Stop was pressed (2026-10-25): the receipt is frozen at
  // that instant — it no longer ticks — while the card's clock runs on in case
  // the cashier cancels. Confirming closes the seat AT that instant for exactly
  // this total (`priced_at` + `expected_total`); a receipt the server finds
  // stale or changed is refused and read again (see confirmStop). It is read
  // again too after a line is taken off, or when the seat is ended elsewhere.
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.status]);

  const remove = async (itemId: number, name: string, additional: boolean) => {
    // Asked first, as on the Add Product dialog: one misplaced click must not
    // take a line off the bill a guest is about to pay. An additional item is
    // asked about — and reported — as what it is.
    const question = additional ? "session.additionalRemoveConfirm" : "session.removeConfirm";
    if (!(await ask(fmt(t(question), name), { destructive: true }))) return;
    setBusy(true);
    try {
      await sessionRepository.removeItem(session.id, itemId);
      notify.message("error", fmt(t(additional ? "session.additionalRemoved" : "session.removedOne"), name));
      onItemRemoved();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to remove");
    } finally { setBusy(false); }
  };

  /**
   * Reset the counter from the receipt (2026-11-05, owner): the player is
   * leaving after a few minutes. Asked first, naming what goes; the server
   * waives its own figure (`reset-time`) and the receipt is READ AGAIN, so
   * what Confirm then charges is the server's new bill at its new instant —
   * the old one would be refused as changed. Goods and pads stay on it.
   */
  const resetTime = async () => {
    if (bill === null) return;
    // The receipt is frozen at Stop (up to ten minutes old): the figure asked
    // about is read now, so the question names what the server will waive.
    let current: IBillBreakdown;
    try {
      current = await sessionRepository.preview(session.id);
      setBill(current);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    const question = fmt(t("session.reset.confirmReceipt"), money(Number(current.time_cost), receiptPrecision));
    if (!(await ask(question, { destructive: true }))) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await sessionRepository.resetTime(session.id);
      notify.message("success", fmt(t("session.reset.toast"), deviceLabel, money(Math.max(0, r.waived ?? 0))));
      onTimeReset?.();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  // Nothing to pay, nothing to change: a waived bill asks for no banknotes.
  const asksForCash = method === "cash" && bill !== null && !bill.is_free;
  const change = asksForCash ? cashChange(billCents(bill.total), received) : null;
  const cashBlocks = change !== null && (change.state === "short" || change.state === "invalid");

  const confirmStop = async () => {
    if (stoppingNow.current || cashBlocks) return;
    // ⚠️ Checked here so the cashier is told BEFORE the request, but the server
    // enforces the same rule and is what actually decides — this is a courtesy,
    // not the guard. A stop refused for a missing note leaves the seat running.
    if (paymentNoteMissing(method, other)) {
      setErr(t("session.payOtherRequired"));
      return;
    }

    stoppingNow.current = true;
    setBusy(true); setErr(null);
    try {
      const r = await sessionRepository.stop(session.id, {
        payment_method: method,
        ...(change?.state === "ok" ? { cash_received: toAmount(change.receivedCents) } : {}),
        // Sent only for `other`: the server strips it for the other two, and a
        // card payment carrying a note called "Idram" is a contradiction the
        // history would then have to display.
        ...(method === "other" ? { payment_method_other: other.trim() } : {}),
        // The figure on screen is the figure charged (2026-10-25).
        ...(bill?.priced_at ? { priced_at: bill.priced_at, expected_total: Number(bill.total) } : {}),
      });
      setStopped(r.breakdown);
      setHandover(r.cash ?? null);
      onConfirmed({ cancelled: false });
    } catch (e) {
      // Refused as stale or changed (2026-10-25) — older than ten minutes, or
      // a product, pad, pause, waiver or move since: the server's sentence,
      // and the receipt read again so the new figure is what is confirmed.
      // (Cash short against it is the same 422 and the same remedy.)
      if ((e as { status?: number }).status === 422) {
        // The banknotes short of the bill keep their own sentence; any other
        // refusal is the server's.
        const body = (e as { body?: { errors?: Record<string, unknown> } }).body;
        const cashShort = change?.state === "ok" && body?.errors?.cash_received !== undefined;
        setErr(cashShort || !(e instanceof Error) || !e.message ? t("session.cashBillGrew") : e.message);
        // Not `reload()`: it clears the error this line just set.
        void sessionRepository.preview(session.id).then(setBill).catch(() => {});
      } else {
        setErr(e instanceof Error ? e.message : "Failed to stop");
      }
      setBusy(false);
    } finally {
      stoppingNow.current = false;
    }
  };

  /**
   * Cancel the seat (2026-11-06, owner): the player sat down and changed his
   * mind. Unlike the counter reset the seat does NOT run on — it ends as Stop
   * ends it, and the server waives the whole bill: time, pads and goods. Asked
   * first, destructively; the receipt then shows the server's own result.
   */
  const cancelSession = async () => {
    if (stoppingNow.current) return;
    if (!(await ask(fmt(t("session.cancel.confirm"), deviceLabel), { destructive: true }))) return;
    stoppingNow.current = true;
    setBusy(true); setErr(null);
    try {
      const r = await sessionRepository.cancel(session.id);
      setStopped(r.breakdown);
      setHandover(null);
      onConfirmed({ cancelled: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    } finally {
      stoppingNow.current = false;
    }
  };

  const view = stopped ?? bill;
  const cancelled = view?.is_cancelled === true;

  // ONE precision decision for the whole receipt, taken from every figure on
  // it. Deciding per figure printed "4.72", "500" and "505" on the same bill:
  // the first is under the per-figure threshold and the other two are over it,
  // so the column stopped adding up. A receipt is read as a column.
  const receiptPrecision = view === null ? undefined : sharedPrecision([
    Number(view.time_cost),
    Number(view.time_waived ?? 0),
    Number(view.total),
    ...(view.joysticks ?? []).map((j) => Number(j.amount)),
    ...view.items.map((it) => Number(it.line_total)),
  ]);


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
  // Billed by the hour: count-up, or a planned start with no package.
  const byTheHour = view !== null && (view.mode === "open" || !view.package_name);

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 520, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          {cancelled
            ? t("session.cancel.done")
            : finished ? t("session.checkoutDone") : `${t("session.checkoutPreviewTitle")} · ${deviceLabel}`}
        </h2>
        {/* Opening this ends nothing (2026-10-25): the seat plays on, the
            figures re-read every few seconds, and only the confirm below
            stops it — the server prices it at that instant. Said in words,
            because "Подтвердить и закрыть" read as "close this window". */}
        {/* Ended while this was open, by somebody or something else: the bill
            below is theirs, final, and nothing here will stop it again. */}
        {endedWithoutUs && stopped === null && (
          <span className="muted" style={{ fontSize: 12 }} data-testid="checkout-ended-elsewhere">
            {t("session.checkoutEndedElsewhere")}
          </span>
        )}
        {!finished && (
          <span className="muted" style={{ fontSize: 12 }} data-testid="checkout-still-running">
            {t("session.checkoutStillRunning").replace(
              "{0}",
              bill?.priced_at
                ? new Date(bill.priced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
                : "-",
            )}
          </span>
        )}

        {!view ? <SkeletonText lines={5} /> : (
          <div className="col" style={{ gap: 0 }}>
            {/* Time line */}
            <div style={row}>
              <span style={{ flex: 1 }}>
                {/* A package names itself; a seat billed by the hour — count-up
                    or a planned start, which has no package (2026-10-25) —
                    says how long it was played, never "Тариф · " and nothing. */}
                {byTheHour
                  ? `${t("session.timePlayed")}: ${fmtDuration(view.elapsed_minutes, t)}`
                  : `${t("session.tariff")} · ${view.package_name}`}
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
                  {byTheHour && view.hourly_rate != null && (
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
                  {/* Reset the counter right here (2026-11-05): only while the
                      seat runs, for a role that may, and while the TIME has
                      something to reset — goods alone are not reset. */}
                  {!finished && canResetTime && Number(view.time_cost) >= RESET_MIN_AMOUNT && (
                    <button
                      type="button"
                      className="receipt-reset"
                      onClick={() => { void resetTime(); }}
                      disabled={busy}
                      title={t("session.reset.button")}
                      data-testid="receipt-reset"
                    >
                      {t("session.reset.short")}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* What resetting the counter waived (2026-11-05): its own line —
                the time above is already net of it. From the server. */}
            {!view.is_free && Number(view.time_waived ?? 0) > 0 && (
              <div style={row} className="receipt-waived" data-testid="receipt-time-waived">
                <span style={{ flex: 1 }}>{t("session.reset.waived")}</span>
                <span style={{ fontWeight: 700 }}>−{money(Number(view.time_waived), receiptPrecision)}</span>
              </div>
            )}

            {/* The VIP minimum charge, when it is in the time line above: what
                was billed and what the time played came to, so the figure has
                its reason on the receipt. From the server, never recomputed. */}
            {!view.is_free && view.minimum_charge?.applied && (
              <div style={row} className="muted" data-testid="receipt-min-charge">
                <span style={{ flex: 1, fontSize: 12 }}>
                  {fmt(t("vipMin.receipt"), fmtDuration(view.minimum_charge.billed_minutes, t))}
                </span>
                <span style={{ fontSize: 12 }}>
                  {fmt(t("vipMin.receiptPlayed"), money(Number(view.minimum_charge.played_time_cost), receiptPrecision))}
                </span>
              </div>
            )}

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

            {/* Products bought during the session (2026-10-25): their own
                section — quantity × unit price = line — and their own total,
                the server's `items_total`. The total below already includes
                them; this is the breakdown, never added twice. */}
            {view.items.length > 0 && (
              <div className="receipt-items" data-testid="receipt-items">
                <span className="label" style={{ marginTop: 8 }}>{t("session.itemsBought")}</span>
                {view.items.map((it) => (
                  <div key={it.id} style={row}>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{it.name}</span>
                    {/* An HOURLY line is a rate and a duration, so it reads like a
                        pad's line rather than like a drink's: "90 m · 700/h", and
                        "returned" once its clock has stopped. A sold one reads
                        "2 × 500". */}
                    <span className="muted" style={{ marginRight: 12, fontSize: 12, whiteSpace: "nowrap" }}>
                      {it.is_hourly
                        ? `${it.minutes ?? 0} ${t("time.minShort") || "m"} · ${money(Number(it.price), receiptPrecision)}${t("session.extraPerHour")}${it.qty > 1 ? ` × ${it.qty}` : ""}${it.returned_at ? ` · ${t("session.extraReturned")}` : ""}`
                        : `${it.qty} × ${money(Number(it.price), receiptPrecision)}`}
                    </span>
                    <span style={{ fontWeight: 700, marginRight: 8 }}>
                      {money(Number(it.line_total), receiptPrecision)}
                    </span>
                    {!finished && (
                      <button type="button" onClick={() => void remove(it.id, it.name, it.is_additional === true)} disabled={busy} style={removeBtn} title={t("session.removeItemTitle")}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div style={{ ...row, borderTop: "1px dashed var(--color-border)" }} data-testid="receipt-items-total">
                  <span style={{ flex: 1 }}>{t("session.itemsTotal")}</span>
                  <span style={{ fontWeight: 700, marginRight: finished ? 0 : 32 }}>
                    {money(Number(view.items_total), receiptPrecision)}
                  </span>
                </div>
              </div>
            )}

            {/* Total */}
            <div style={{ ...row, borderTop: "2px solid #07ddf1", marginTop: 6, paddingTop: 12 }}>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{t("session.totalDue")}</span>
              {/* A waived bill says so in words. A correct 0 here is exactly
                  what an operator double-checks — it reads as "the till
                  failed" rather than "somebody decided this". What was given
                  away is still on the row and in the audit log; this receipt
                  is what the player is being handed, and it owes them one
                  number. */}
              <span style={{ fontWeight: 800, fontSize: 18, color: "var(--color-primary)" }}>
                {cancelled
                  ? t("session.cancel.bill")
                  : view.is_free
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
          // The one list of methods, shared with the till (PaymentMethodPicker).
          <PaymentMethodPicker
            name={`pay-${session.id}`}
            method={method}
            onMethod={(m) => { setMethod(m); setReceived(""); setErr(null); }}
            note={other}
            onNote={(v) => { setOther(v); setErr(null); }}
            disabled={busy}
          />
        )}

        {!finished && asksForCash && bill && change && (
          <CashChangePanel
            dueCents={billCents(bill.total)}
            received={received}
            onReceived={(v) => { setReceived(v); setErr(null); }}
            change={change}
            disabled={busy}
          />
        )}
        {finished && handover && (
          <CashChangePanel
            dueCents={billCents(view?.total ?? 0)}
            received={handover.received}
            change={{ state: "ok", receivedCents: billCents(handover.received), changeCents: billCents(handover.change) }}
          />
        )}

        {err && <div className="error">{err}</div>}

        <div className="row-between" style={{ marginTop: 4 }}>
          {finished ? (
            <Button onClick={onClose}>{t("action.close")}</Button>
          ) : (
            <>
              {/* Back to the running seat: nothing was sent, nothing stopped. */}
              <Button variant="secondary" onClick={onClose} disabled={busy}>{t("session.checkoutKeepPlaying")}</Button>
              {/* The player changed his mind (2026-11-06): end the seat with
                  nothing owed. Its own button, apart from the counter reset
                  above, which keeps the seat running. */}
              {canCancel && (
                <Button variant="secondary" className="receipt-cancel" onClick={() => { void cancelSession(); }} disabled={busy || !bill} data-testid="receipt-cancel">
                  {t("session.cancel.button")}
                </Button>
              )}
              <Button onClick={confirmStop} disabled={busy || !bill || cashBlocks} data-testid="stop-confirm">
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
  color: "var(--color-danger)", cursor: "pointer", fontSize: 14, lineHeight: 1,
};

export default StopReceiptModal;
