import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { fmt } from "@/i18n/translations";
import { formatApiError } from "@/api/errors";
import { ISessionApi } from "@/types/sessions";
import { extraItemQuote } from "@/components/sessions/sessionAmount";
import { sessionRepository } from "@/repositories/SessionRepository";
import { useLang } from "@/i18n/LanguageContext";
import { useState } from "react";

/**
 * Hand out what THIS room hands out, however many of them.
 *
 * One dialog for every room, because the thing it sells is data rather than
 * code: a poker table deals chips, a billiard table lends a cue, a darts board
 * hands over darts, and the only difference between them is the word the owner
 * typed into the place form. Nothing here spells any of those words — every
 * label takes the name from `session.extra_item`, so a room invented tomorrow
 * reads correctly without a line being written.
 *
 * It is deliberately NOT the pads' control. A pad has a slot, a base kit of
 * two and a ceiling of four; an extra has a count and nothing else, so it asks
 * the one question a count needs and quotes the total before anything is
 * written.
 *
 * ## What is not decided here
 *
 * The PRICE. The figure shown is the server's `unit_price` — the room's own,
 * or 0.00 on a seat that charges once for the session and already has — and it
 * is quoted, never sent: the write carries a count and the `extra` flag, and
 * the server prices it from the place. A dialog that could name a price would
 * be a dialog that lets a manager write one.
 */
export default function AddExtraItemDialog({
  session,
  onClose,
  onAdded,
}: {
  session: ISessionApi;
  onClose: () => void;
  onAdded?: () => void;
}) {
  const { t, money } = useLang();
  const extra = session.extra_item ?? null;
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The caller only opens this for a seat that has one, but a session can go
  // stale between the click and the render, and an empty dialog is better than
  // a crash on `extra.name`.
  if (!extra) return null;

  const ceiling = extra.max_qty > 0 ? extra.max_qty : 999;
  /**
   * Every figure on this screen, from the ONE function that prices a
   * hand-out.
   *
   * Not `unit × qty` inline: the room may include the first few in its rate,
   * and a hand-out that straddles that boundary is part free and part paid.
   * The rule is the server's, it is stated once in `sessionAmount.ts` beside
   * every other mirror of the backend's arithmetic, and this dialog renders
   * what it returns.
   *
   * `hourly` is a RATE, not a price: there is no total to quote before the
   * thing goes out, only what an hour of the CHARGED units costs. Saying
   * "700 × 3 = 2 100" would be a promise the bill does not keep, and saying
   * "700/h × 3" where one of the three is free would be a smaller version of
   * the same lie.
   */
  const quote = extraItemQuote(extra, qty);
  const unit = quote.unit;
  const hourly = quote.hourly;
  // What the room's rate covers per session, and what is left of it here.
  const allowance = Math.max(0, Math.trunc(Number(extra.included ?? 0)) || 0);
  const remaining = Math.max(0, Math.trunc(Number(extra.included_remaining ?? 0)) || 0);
  // Nothing is owed for this hand-out, and the reason is the allowance rather
  // than a price of zero.
  const allFree = quote.zeroQty > 0 && quote.chargedQty === 0;

  const clamp = (n: number) => Math.min(ceiling, Math.max(1, Math.trunc(n) || 1));

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await sessionRepository.addItems(session.id, [{ extra: true, qty }]);
      onAdded?.();
      onClose();
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose}>
      {/* `open` is not optional and the title is not a prop: this component
          owns its own card and heading, the way every other dialog here does.
          Passing a `title` instead rendered nothing at all — a modal with no
          `open` is a modal that never opens, and a mocked Modal in a unit test
          cannot see that. */}
      <div className="card col" style={{ width: 420, maxWidth: "92vw", gap: 16 }}>
        <h2 style={{ margin: 0 }}>{fmt(t("session.extraAdd"), extra.name)}</h2>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">{fmt(t("session.extraQty"), extra.name)}</span>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <Button variant="secondary" disabled={busy || qty <= 1} onClick={() => setQty(clamp(qty - 1))}>
              −
            </Button>
            <input
              className="input"
              type="number"
              min={1}
              max={ceiling}
              step={1}
              value={qty}
              disabled={busy}
              onChange={(e) => setQty(clamp(Number(e.target.value)))}
              style={{ width: 96, textAlign: "center" }}
              aria-label={fmt(t("session.extraQty"), extra.name)}
            />
            <Button variant="secondary" disabled={busy || qty >= ceiling} onClick={() => setQty(clamp(qty + 1))}>
              +
            </Button>
          </div>
        </div>

        {/* What it will cost, before anything is written. On a seat that
            charges once and already has, this is a real zero and says so —
            the thing still goes out, and the receipt still lists it. */}
        {/* The room's allowance, stated before the arithmetic that uses it:
            an operator handing over three and being charged for one needs to
            see why, and "the rate covers two" is that why. Drawn only where
            the room has one, so nothing changes for the rooms that do not. */}
        {allowance > 0 && (
          <span className="muted">{fmt(t("session.extraIncluded"), allowance, remaining)}</span>
        )}

        <div className="row row-between" style={{ gap: 8 }}>
          <span className="muted">
            {allFree
              ? fmt(t("session.extraAllFree"), quote.zeroQty)
              : hourly
                ? fmt(t("session.extraHourlyNote"), extra.name)
                : extra.charge_mode === "once"
                  ? t("session.extraOnceNote")
                  : `${money(unit)} × ${quote.chargedQty}`}
          </span>
          <span className="label">
            {/* An hourly extra quotes a RATE and a count of the units that
                are actually charged; when the allowance covers them all there
                is no rate owed, and the honest figure is zero. */}
            {hourly && quote.chargedQty > 0
              ? `${money(unit)}${t("session.extraPerHour")} × ${quote.chargedQty}`
              : money(quote.total)}
          </span>
        </div>

        {/* Part free, part paid: the split that makes the figure above look
            wrong until it is spelled out. */}
        {/* What the RECEIPT will show at zero, not what the allowance covers:
            a `once` surplus is handed over at 0.00 too, so `freeQty` here
            would print one while the bill prints two. */}
        {quote.zeroQty > 0 && quote.chargedQty > 0 && (
          <span className="muted">{fmt(t("session.extraPartFree"), quote.zeroQty, quote.qty)}</span>
        )}

        {err && <span className="error">{err}</span>}

        <div className="row row-between" style={{ gap: 8 }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy ? t("company.saving") : fmt(t("session.extraAdd"), extra.name)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
