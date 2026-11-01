import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { shiftAmount } from "@/shifts/cash";
import type { CashChange } from "./cashChange";

/**
 * "Received from the guest" and the change to hand back (2026-10-19).
 *
 * Editable before the stop (`onReceived`), read-only after it, when the figures
 * are the server's. The change is said in words and in a large figure, so it
 * is not carried by colour alone; a shortfall says how much is missing.
 */
interface Props {
  dueCents: number;
  received: string;
  change: CashChange;
  /** Omitted after the stop: the panel then reports, it does not ask. */
  onReceived?: (value: string) => void;
  disabled?: boolean;
  /**
   * Focus the amount when it appears (the Stop receipt's default). Off in the
   * till's sale, where it appears while the cashier is still typing lines.
   */
  autoFocus?: boolean;
}

const CashChangePanel = ({ dueCents, received, change, onReceived, disabled, autoFocus = true }: Props) => {
  const { t, money } = useLang();
  const m = (cents: number) => shiftAmount(money, cents / 100);

  return (
    <div className="col" style={panel} data-testid="cash-change">
      {onReceived && (
        <Input
          label={t("session.cashReceived")}
          inputMode="decimal"
          placeholder={m(dueCents)}
          value={received}
          onChange={(e) => onReceived(e.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
          data-testid="cash-received"
        />
      )}
      {/* The bill is printed right above as the receipt's total; it is
          repeated here only beside a received amount, as the sum's first line. */}
      {(change.state === "ok" || change.state === "short") && (
        <>
          <div className="row-between" style={line}>
            <span className="muted">{t("session.cashDue")}</span>
            <span>{m(dueCents)}</span>
          </div>
          <div className="row-between" style={line}>
            <span className="muted">{t("session.cashReceivedShort")}</span>
            <span>{m(change.receivedCents)}</span>
          </div>
        </>
      )}

      {change.state === "empty" && (
        <span className="muted" style={{ fontSize: 12 }} data-testid="cash-change-hint">{t("session.cashReceivedHint")}</span>
      )}
      {change.state === "invalid" && (
        <span className="error" style={{ fontSize: 12 }} data-testid="cash-change-invalid">{t("session.cashReceivedInvalid")}</span>
      )}
      {change.state === "short" && (
        <div className="row-between" style={{ ...line, color: "var(--color-danger)", fontWeight: 600 }} data-testid="cash-change-short">
          <span>⚠ {t("session.cashMissing")}</span>
          <span>{m(change.missingCents)}</span>
        </div>
      )}
      {change.state === "ok" && (
        <div className="row-between" style={changeRow} data-testid="cash-change-value">
          <strong>{t("session.cashChange")}</strong>
          <strong style={{ fontSize: 22 }}>{m(change.changeCents)}</strong>
        </div>
      )}
    </div>
  );
};

const panel: React.CSSProperties = {
  gap: 4,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-alt)",
};
const line: React.CSSProperties = { padding: "2px 0", fontSize: 14 };
const changeRow: React.CSSProperties = {
  marginTop: 6,
  paddingTop: 8,
  borderTop: "1px solid var(--color-border)",
  alignItems: "baseline",
  color: "var(--color-success)",
};

export default CashChangePanel;
