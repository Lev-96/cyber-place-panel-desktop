import { apiSetBranchUnlockPin } from "@/api/branches";
import Button from "@/components/ui/Button";
import { useState } from "react";

interface Props {
  branchId: number;
  /** ISO of last update, or null when never set. */
  updatedAt: string | null;
  onSaved: (updatedAt: string) => void;
}

/**
 * Emergency-unlock PIN section on the branch settings screen.
 *
 * The PIN is what a cashier types directly on a stuck kiosk's lock
 * screen when the panel/server is unreachable. Backend hashes with
 * bcrypt; the plaintext is never read back from the server. Every
 * agent in the branch picks up the new hash on its next /agent/hello
 * (next heartbeat tick, ~2-5s after the panel save).
 *
 * Constraints (mirrored from backend regex):
 *   - 4-6 digits only
 *   - digits 0-9 (no letters / symbols / spaces)
 *
 * The display masks the PIN as a password — there's no "show" toggle
 * because revealing a 4-digit number above the keyboard on a shared
 * staff PC is exactly the kind of leak this whole feature exists to
 * prevent.
 */
const BranchUnlockPinCard = ({ branchId, updatedAt, onSaved }: Props) => {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const clean = pin.trim();
    if (!/^\d{4,6}$/.test(clean)) {
      setError("PIN должен содержать 4–6 цифр");
      return;
    }
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      const res = await apiSetBranchUnlockPin(branchId, clean);
      setPin("");
      setSuccess(true);
      onSaved(res.data.unlock_pin_updated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gradient-card" style={{ marginTop: 12 }}>
      <div className="gradient-card-inner">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          PIN экстренного разблокирования
        </div>
        <div className="muted" style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.4 }}>
          Кассир сможет ввести этот PIN прямо на заблокированном ПК, если связь
          с панелью или сервером пропала. Работает даже офлайн. PIN из 4–6 цифр.
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            inputMode="numeric"
            type="password"
            placeholder="Новый PIN"
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
          <Button onClick={() => void handleSubmit()} disabled={busy || pin.length < 4}>
            {busy ? "Сохранение…" : updatedAt ? "Обновить PIN" : "Установить PIN"}
          </Button>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {updatedAt
            ? `Установлен · ${new Date(updatedAt).toLocaleString("ru-RU", { hour12: false })}`
            : "PIN ещё не установлен"}
        </div>
        {error && <div className="error" style={{ marginTop: 6 }}>{error}</div>}
        {success && <div style={{ color: "#22c55e", marginTop: 6, fontSize: 12 }}>Сохранено.</div>}
      </div>
    </div>
  );
};

export default BranchUnlockPinCard;
