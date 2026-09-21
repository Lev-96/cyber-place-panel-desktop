import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { fmt } from "@/i18n/translations";
import { formatApiError } from "@/api/errors";
import { ISessionApi } from "@/types/sessions";
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
  const unit = Number(extra.unit_price);
  // "Once for the session" charges for one whatever the count, which is what
  // the receipt will say, so it is what this line says too.
  const total = extra.charge_mode === "once" ? unit : unit * qty;

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
        <div className="row row-between" style={{ gap: 8 }}>
          <span className="muted">
            {extra.charge_mode === "once" ? t("session.extraOnceNote") : `${money(unit)} × ${qty}`}
          </span>
          <span className="label">{money(total)}</span>
        </div>

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
