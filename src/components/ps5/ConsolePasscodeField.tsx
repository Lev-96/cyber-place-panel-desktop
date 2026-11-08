import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { ps5Bridge } from "@/ps5/usePs5Discovery";
import { useEffect, useState } from "react";

interface Props {
  hostId: string;
  /** Tells the console watcher something about this console changed. */
  onChanged: () => void;
}

/**
 * The console user's PS5 login passcode, for putting the console to rest.
 *
 * A console whose user has a login passcode asks for it on a Remote Play login
 * made while nobody is signed in on it — and without it the panel cannot rest
 * the console (Stop right after Start, or a session nobody played). The code is
 * kept like the console key: on this computer, OS-encrypted, never readable
 * back. The field is cleared as soon as it is saved.
 *
 * Draws nothing on a build whose preload has no passcode store.
 */
const ConsolePasscodeField = ({ hostId, onChanged }: Props) => {
  const { t } = useLang();
  const api = ps5Bridge();
  const [has, setHas] = useState<boolean | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!api?.hasPasscode) return;
    let alive = true;
    api.hasPasscode(hostId)
      .then((r) => { if (alive) setHas(r.has); })
      .catch(() => { if (alive) setHas(false); });
    return () => { alive = false; };
  }, [api, hostId]);

  if (!api?.setPasscode || !api.hasPasscode || has === null) return null;

  const save = async () => {
    if (!/^\d{4}$/.test(typed)) {
      setError(t("ps5.passcode.invalid"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.setPasscode!(hostId, typed);
      if (!result.saved) {
        setError(t("ps5.error.TRANSPORT_ERROR"));
        return;
      }
      setTyped("");
      setHas(true);
      onChanged();
    } catch {
      setError(t("ps5.error.TRANSPORT_ERROR"));
    } finally {
      setBusy(false);
    }
  };

  const forget = async () => {
    setBusy(true);
    try {
      await api.forgetPasscode?.(hostId);
      setHas(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (has) {
    return (
      <div className="ps5-attach" data-testid="ps5-passcode">
        <span className="muted ps5-passcode__state">✓ {t("ps5.passcode.saved")}</span>
        <Button variant="secondary" disabled={busy} onClick={() => void forget()}>
          {t("ps5.passcode.forget")}
        </Button>
      </div>
    );
  }

  return (
    <div className="col ps5-passcode" data-testid="ps5-passcode">
      <div className="muted ps5-passcode__hint">{t("ps5.passcode.hint")}</div>
      <div className="ps5-attach">
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={4}
          aria-label={t("ps5.passcode.label")}
          placeholder={t("ps5.passcode.label")}
          value={typed}
          onChange={(e) => { setTyped(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
          className="ps5-passcode__input"
        />
        <Button disabled={busy || typed.length !== 4} onClick={() => void save()}>
          {t("ps5.passcode.save")}
        </Button>
      </div>
      {error && <div className="ps5-passcode__error" role="alert">{error}</div>}
    </div>
  );
};

export default ConsolePasscodeField;
