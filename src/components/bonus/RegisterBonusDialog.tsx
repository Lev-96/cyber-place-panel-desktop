import QrScanner from "@/components/scanner/QrScanner";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import FixedDialPhoneInput from "@/components/ui/FixedDialPhoneInput";
import { bonusAmountText } from "@/components/bonus/bonusAmount";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import { bonusCodeFromScan, normaliseBonusCode, type IBonusAccount } from "@/types/bonus";
import { notify } from "@/ui/notify";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  onClose: () => void;
  onSaved: (account: IBonusAccount) => void;
  /** A code already read (a scan elsewhere); the dialog opens on step two. */
  initialCode?: string;
}

/**
 * Opening a player's bonus card at the till. Step one: the 6-character code
 * the player shows, typed or scanned from their QR. Step two: their name and
 * phone. The server decides the rest (unknown code, already a card here).
 */
const RegisterBonusDialog = ({ branchId, onClose, onSaved, initialCode }: Props) => {
  const { t, money } = useLang();
  const [code, setCode] = useState(initialCode ?? "");
  const [checked, setChecked] = useState<string | null>(null);
  // A player without a smartphone (2026-11-25): no code, name and phone only.
  const [byPhone, setByPhone] = useState(false);
  const details = checked !== null || byPhone;
  const [scanning, setScanning] = useState(false);
  const [name, setName] = useState("");
  // The national digits (2026-11-25): the box shows +374 fixed, like the Club Card's.
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // This number's card under an earlier copy of the app (2026-11-26): offered
  // to move, from the code check or from the server's answer to «open».
  const [existing, setExisting] = useState<IBonusAccount | null>(null);

  const check = async (raw: string) => {
    const c = normaliseBonusCode(raw);
    if (!c) { setErr(t("bonus.register.codeInvalid")); return; }
    setBusy(true); setErr(null);
    try {
      const r = await bonusRepository.lookup(branchId, c);
      if (r.registered) { setErr(t("bonus.register.already")); return; }
      setExisting(r.existing ?? null);
      // The player's own name and phone, so they are not typed twice.
      if (r.player?.name) setName(r.player.name);
      if (r.player?.phone) setPhone(r.player.phone.replace(/\D/g, "").replace(/^374/, ""));
      setCode(c); setChecked(c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const parsed = parsePhoneNumberFromString("+374" + phone, "AM");
  const phoneOk = !!parsed && parsed.isValid();

  const send = async (move: boolean) => {
    if (!phoneOk || busy) return;
    setBusy(true); setErr(null);
    try {
      const account = await bonusRepository.register(branchId, {
        ...(checked ? { code: checked } : {}), name: name.trim() || null, phone: parsed!.number, ...(move ? { move: true } : {}),
      });
      notify.message("success", t(move ? "bonus.move.done" : "bonus.register.done"));
      onSaved(account);
    } catch (e2) {
      // «This number already has a card here» (409 with the card): offer the move.
      const body = (e2 as { status?: number; body?: { existing?: IBonusAccount } }).status === 409
        ? (e2 as { body?: { existing?: IBonusAccount } }).body : undefined;
      if (body?.existing) setExisting(body.existing);
      else setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!details) { void check(code); return; }
    await send(existing !== null && checked !== null);
  };

  return (
    // Asks before closing only when something was typed or a code was checked:
    // «по номеру телефона» opened and closed empty leaves at once.
    <Modal open onClose={onClose} dirty={checked !== null || code !== "" || name.trim() !== "" || phone !== ""}>
      <form className="col" style={{ gap: 14, minWidth: 340 }} onSubmit={submit} data-testid="bonus-register">
        <h3 style={{ margin: 0 }}>{t("bonus.register.title")}</h3>
        {!details ? (
          <>
            <span className="muted" style={{ fontSize: 13 }}>{t("bonus.register.codeHint")}</span>
            <input className="input" value={code} maxLength={8} autoFocus disabled={busy}
              onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234"
              style={{ fontSize: 22, letterSpacing: 6, textAlign: "center", fontWeight: 700 }} data-testid="bonus-code" />
            {scanning ? (
              <QrScanner height={260} onClose={() => setScanning(false)}
                onResult={(text) => { setScanning(false); const c = bonusCodeFromScan(text); if (c) { setCode(c); void check(c); } else setErr(t("bonus.register.codeInvalid")); }} />
            ) : (
              <Button type="button" variant="secondary" onClick={() => { setErr(null); setScanning(true); }}>{t("bonus.register.scan")}</Button>
            )}
            <button type="button" className="link-button" style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, color: "var(--color-primary)", cursor: "pointer", fontSize: 13 }}
              onClick={() => { setErr(null); setScanning(false); setByPhone(true); }} data-testid="bonus-by-phone">
              {t("bonus.register.byPhone")}
            </button>
          </>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 13 }}>{checked ? t("bonus.register.codeOk").replace("{0}", checked) : t("bonus.register.byPhoneHint")}</div>
            <label className="col" style={{ gap: 4 }}>
              <span className="label">{t("bonus.register.name")}</span>
              <input className="input" value={name} maxLength={80} disabled={busy} onChange={(e) => setName(e.target.value)} autoFocus data-testid="bonus-name" />
            </label>
            <label className="col" style={{ gap: 4 }}>
              <span className="label">{t("bonus.register.phone")}</span>
              <FixedDialPhoneInput countryCode="AM" value={phone} onChange={(v) => { setPhone(v); setExisting(null); }} disabled={busy}
                invalid={phone !== "" && !phoneOk} ariaLabel={t("bonus.register.phone")} placeholder="91 123 456" testId="bonus-phone" />
            </label>
          </>
        )}
        {existing && checked && (
          <div className="bonus-move" role="status" data-testid="bonus-move">
            <strong>{t("bonus.move.title")}</strong>
            <div className="bonus-move__card">
              <span>{existing.name || t("bonus.noName")} · {existing.phone}</span>
              <strong>{t("bonus.balance").replace("{0}", bonusAmountText(money, existing.balance))}</strong>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>{t("bonus.move.lead")}</span>
          </div>
        )}
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button type="submit" disabled={busy || (details ? !phoneOk : code.trim() === "")} data-testid="bonus-register-submit">
            {existing && checked ? t("bonus.move.button") : details ? t("bonus.register.open") : t("bonus.register.check")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RegisterBonusDialog;
