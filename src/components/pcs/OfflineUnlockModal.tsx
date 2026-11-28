import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { pcRepository } from "@/repositories/PcRepository";
import type { IPcApi } from "@/types/sessions";
import { useEffect, useState } from "react";

interface Props {
  pc: IPcApi;
  onClose: () => void;
}

/** «1234 5678»: two groups of four, read aloud and typed without a slip. */
const grouped = (code: string) => code.replace(/^(\d{4})(\d{4})$/, "$1 $2");

/**
 * This PC's own offline emergency code (2026-11-28, security audit): what the
 * kiosk takes when it has no network. Online it takes the branch PIN as
 * before. A used code is spent; staff can also ask for a new one.
 */
const OfflineUnlockModal = ({ pc, onClose }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    pcRepository.offlineUnlock(pc.id)
      .then((r) => { if (alive) setCode(r.code); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [pc.id]);

  const renew = async () => {
    if (busy || !(await confirm(t("pcs.offlineCode.confirmRenew")))) return;
    setBusy(true);
    setErr(null);
    try {
      setCode((await pcRepository.rotateOfflineUnlock(pc.id)).code);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 440, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} data-testid="offline-unlock">
        <h2 style={{ margin: 0 }}>{t("pcs.offlineCode.title")} · {pc.label}</h2>
        <div className="muted" style={{ fontSize: 13 }}>{t("pcs.offlineCode.hint")}</div>
        <code data-testid="offline-unlock-code" style={{
          alignSelf: "center", padding: "12px 20px", borderRadius: 10, border: "1px solid var(--color-border)",
          background: "var(--color-bg)", color: "var(--color-primary)", fontSize: 28, letterSpacing: "0.12em",
          fontVariantNumeric: "tabular-nums",
        }}>{code === null ? "…" : grouped(code)}</code>
        <div className="muted" style={{ fontSize: 12 }}>{t("pcs.offlineCode.spent")}</div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row-between">
          <Button variant="secondary" onClick={renew} disabled={busy || code === null} data-testid="offline-unlock-renew">{t("pcs.offlineCode.renew")}</Button>
          <Button onClick={onClose}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default OfflineUnlockModal;
