import { apiGetBranchUnlockPin, apiSetBranchUnlockPin } from "@/api/branches";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useEffect, useState } from "react";

interface Props {
  branchId: number;
  /** ISO of last update, or null when never set. */
  updatedAt: string | null;
  onSaved: (updatedAt: string) => void;
}

/**
 * Emergency-unlock PIN section on the branch settings screen.
 *
 * Two surfaces in one card:
 *   1. CURRENT PIN — fetched on mount via apiGetBranchUnlockPin
 *      (server decrypts the APP_KEY-encrypted column). Masked by
 *      default as ••••, the eye icon toggles to plaintext so the
 *      owner can recover from "I forgot what I set last week"
 *      without forcing a rotation.
 *   2. NEW PIN INPUT — when the owner wants to change it. Same
 *      masked/visible toggle. On submit, calls apiSetBranchUnlockPin
 *      which writes both the bcrypt hash (agents verify against this)
 *      and the encrypted copy (shows back here next mount).
 *
 * Constraints (mirrored from backend regex):
 *   - 4–6 digits, digits only.
 */
const BranchUnlockPinCard = ({ branchId, updatedAt: initialUpdatedAt, onSaved }: Props) => {
  const { t } = useLang();
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [currentVisible, setCurrentVisible] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(true);

  const [pin, setPin] = useState("");
  const [newVisible, setNewVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Fetch the current PIN on mount. Server decrypts under APP_KEY;
  // null means "never set" OR "legacy hash-only row that predates
  // the encrypted column."
  useEffect(() => {
    let alive = true;
    void apiGetBranchUnlockPin(branchId)
      .then((res) => { if (alive) setCurrentPin(res.data.pin); })
      .catch(() => { if (alive) setCurrentPin(null); })
      .finally(() => { if (alive) setLoadingCurrent(false); });
    return () => { alive = false; };
  }, [branchId]);

  const handleSubmit = async () => {
    const clean = pin.trim();
    if (!/^\d{4,6}$/.test(clean)) {
      setError(t("unlockPin.invalid"));
      return;
    }
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      const res = await apiSetBranchUnlockPin(branchId, clean);
      setUpdatedAt(res.data.unlock_pin_updated_at);
      setCurrentPin(clean);
      setPin("");
      setSuccess(true);
      onSaved(res.data.unlock_pin_updated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unlockPin.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gradient-card" style={{ marginTop: 12 }}>
      <div className="gradient-card-inner">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {t("unlockPin.title")}
        </div>
        <div className="muted" style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.4 }}>
          {t("unlockPin.desc")}
        </div>

        {/* Current PIN — read-only, masked by default with eye toggle. */}
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            {t("unlockPin.current")}
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <input
              className="input"
              readOnly
              value={
                loadingCurrent
                  ? "..."
                  : currentPin === null
                    ? ""
                    : currentVisible
                      ? currentPin
                      : "•".repeat(currentPin.length)
              }
              placeholder={loadingCurrent ? "" : t("unlockPin.notSet")}
              style={{ maxWidth: 200, letterSpacing: currentVisible ? "normal" : "0.3em" }}
            />
            <button
              type="button"
              onClick={() => setCurrentVisible((v) => !v)}
              disabled={loadingCurrent || currentPin === null}
              title={currentVisible ? t("unlockPin.hide") : t("unlockPin.show")}
              aria-label={currentVisible ? t("unlockPin.hide") : t("unlockPin.show")}
              style={eyeButtonStyle}
            >
              {currentVisible ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {/* New PIN — write-only entry. Default masked + eye toggle. */}
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          {currentPin ? t("unlockPin.change") : t("unlockPin.set")}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            inputMode="numeric"
            type={newVisible ? "text" : "password"}
            placeholder={t("unlockPin.newPlaceholder")}
            value={pin}
            onChange={(e) => {
              setError(null);
              setSuccess(false);
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            style={{ maxWidth: 200 }}
            disabled={busy}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setNewVisible((v) => !v)}
            disabled={busy || pin.length === 0}
            title={newVisible ? t("unlockPin.hide") : t("unlockPin.show")}
            aria-label={newVisible ? t("unlockPin.hide") : t("unlockPin.show")}
            style={eyeButtonStyle}
          >
            {newVisible ? "🙈" : "👁"}
          </button>
          <Button onClick={() => void handleSubmit()} disabled={busy || pin.length < 4}>
            {busy ? t("company.saving") : currentPin ? t("unlockPin.update") : t("unlockPin.set")}
          </Button>
        </div>

        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {updatedAt
            ? fmt(t("unlockPin.setAt"), new Date(updatedAt).toLocaleString(undefined, { hour12: false }))
            : t("unlockPin.notSet")}
        </div>
        {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
        {success && <div style={{ color: "#22c55e", marginTop: 6, fontSize: 12 }}>{t("unlockPin.saved")}</div>}
      </div>
    </div>
  );
};

const eyeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 18,
  width: 36,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "inherit",
};

export default BranchUnlockPinCard;
