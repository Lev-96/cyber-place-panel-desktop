import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { IBillBreakdown } from "@/api/sessions";
import { useLang } from "@/i18n/LanguageContext";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { useEffect, useState } from "react";

interface Props {
  session: ISessionApi;
  onClose: () => void;
  onConfirmed: () => void;
  onItemRemoved: () => void;
}

const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
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

  const deviceLabel = session.pc_label ?? `#${session.pc_id}`;

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 520, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          {stopped ? t("session.checkoutDone") : `${t("session.checkoutTitle")} · ${deviceLabel}`}
        </h2>

        {!view ? <Spinner /> : (
          <div className="col" style={{ gap: 0 }}>
            {/* Time line */}
            <div style={row}>
              <span style={{ flex: 1 }}>
                {view.mode === "open"
                  ? `${t("session.timePlayed")} — ${fmtDuration(view.elapsed_minutes)}`
                  : `${t("session.tariff")} · ${view.package_name ?? ""}`}
              </span>
              {view.mode === "open" && view.hourly_rate != null && (
                <span className="muted" style={{ marginRight: 12, fontSize: 12 }}>
                  {money(Number(view.hourly_rate))}/ч
                </span>
              )}
              <span style={{ fontWeight: 700 }}>{money(Number(view.time_cost))}</span>
            </div>

            {/* Items */}
            {view.items.map((it) => (
              <div key={it.id} style={row}>
                <span style={{ flex: 1 }}>{it.name}{it.qty > 1 ? ` × ${it.qty}` : ""}</span>
                <span className="muted" style={{ marginRight: 12, fontSize: 12 }}>
                  {money(Number(it.price))}{it.qty > 1 ? ` × ${it.qty}` : ""}
                </span>
                <span style={{ fontWeight: 700, marginRight: 8 }}>{money(Number(it.line_total))}</span>
                {!stopped && (
                  <button type="button" onClick={() => remove(it.id)} disabled={busy} style={removeBtn} title="Удалить позицию">
                    ×
                  </button>
                )}
              </div>
            ))}

            {/* Total */}
            <div style={{ ...row, borderTop: "2px solid #07ddf1", marginTop: 6, paddingTop: 12 }}>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{t("session.totalDue")}</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: "#07ddf1" }}>{money(Number(view.total))}</span>
            </div>
          </div>
        )}

        {err && <div className="error">{err}</div>}

        <div className="row-between" style={{ marginTop: 4 }}>
          {stopped ? (
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
