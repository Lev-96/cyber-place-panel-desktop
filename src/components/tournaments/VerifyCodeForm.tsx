import { apiVerifyRegistrationCode, VerifyResult } from "@/api/tournamentRegistrations";
import { formatApiError } from "@/api/errors";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import QrScanner from "@/components/scanner/QrScanner";
import { useLang } from "@/i18n/LanguageContext";
import { FormEvent, useState } from "react";

interface Props {
  tournamentId: number;
  /**
   * Called after a successful verification so the parent
   * (RegistrationsList) can re-fetch the participants list and
   * render the new ✓ Verified badge in place.
   */
  onVerified: (result: VerifyResult) => void;
}

/**
 * Staff-facing code-verification widget. Lives on the tournament
 * detail page above the participants list.
 *
 * Two input paths, single submit logic:
 *   1. Manual text entry (always available, default focus).
 *   2. QR scan via the camera (opens QrScanner inside a Modal).
 *      When jsQR decodes a code, we fill the input AND auto-submit
 *      so the staff doesn't have to click again.
 *
 * The component is intentionally a pure presenter on top of
 * `apiVerifyRegistrationCode`. Backend services do all the
 * authorization + state-machine work; we just shape user input
 * and reflect the result.
 *
 * Error UX:
 *   - 404 / unknown code → translated "verification failed"
 *   - 409 already verified → translated "already verified"
 *   - 400 wrong branch → backend message bubbles up via
 *     `formatApiError` (it's not a state the staff can recover
 *     from — they're logged in on the wrong account).
 */
const VerifyCodeForm = ({ tournamentId, onVerified }: Props) => {
  const { t } = useLang();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const submitCode = async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const { data } = await apiVerifyRegistrationCode({
        tournament_id: tournamentId,
        code: trimmed,
      });
      const guestName = [data.guest?.first_name, data.guest?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      setOk(
        guestName
          ? `${t("registrations.verifySuccess")}: ${guestName}`
          : t("registrations.verifySuccess"),
      );
      setCode("");
      onVerified(data);
    } catch (e) {
      setErr(formatApiError(e) || t("registrations.verifyFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitCode(code);
  };

  const onScanResult = (text: string) => {
    setScannerOpen(false);
    setCode(text);
    void submitCode(text);
  };

  return (
    <div className="card col" style={{ gap: 8 }}>
      <h3 style={{ margin: 0 }}>{t("registrations.verifyCodeTitle")}</h3>
      <div className="muted" style={{ fontSize: 12 }}>
        {t("registrations.verifyCodeHint")}
      </div>
      <form
        onSubmit={onSubmit}
        className="row"
        style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input
            placeholder={t("registrations.verifyCodePlaceholder")}
            value={code}
            // Force uppercase as the user types so the visible value
            // matches the backend's canonical form. Less surprising
            // than silent server-side uppercase + a different value
            // on the screen.
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
        </div>
        <Button type="submit" disabled={busy || !code.trim()}>
          {busy ? "…" : t("registrations.verifyButton")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setErr(null);
            setOk(null);
            setScannerOpen(true);
          }}
          disabled={busy}
        >
          {t("registrations.scanQrButton")}
        </Button>
      </form>
      {err && <div className="error">{err}</div>}
      {ok && <div className="success" style={{ color: "#22c55e" }}>{ok}</div>}

      {scannerOpen && (
        <Modal open onClose={() => setScannerOpen(false)}>
          <div className="card col" style={{ gap: 10, width: 420, maxWidth: "90vw" }}>
            <h3 style={{ margin: 0 }}>{t("registrations.scanQrButton")}</h3>
            <QrScanner
              onResult={onScanResult}
              onClose={() => setScannerOpen(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default VerifyCodeForm;
