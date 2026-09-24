import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { PaymentMethod } from "@/api/sessions";

/**
 * How the money was taken — ONE list, for a session's stop and a sale at the
 * till alike (2026-09-24). The backend's twin is `App\Support\PaymentMethod::ALL`,
 * and both screens read these three, so a method added later lands on both.
 *
 * Cash leads: it is the common case at a counter, and a default keeps the
 * ordinary payment one click.
 */
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "card", "other"];

const LABEL_KEY: Record<PaymentMethod, string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "session.payOther",
};

/** `other` must say what it was (a transfer app, a voucher) — the server's rule too. */
export const paymentNoteMissing = (method: PaymentMethod, note: string): boolean =>
  method === "other" && note.trim() === "";

interface Props {
  /** The radio group's name — unique per open form. */
  name: string;
  method: PaymentMethod;
  onMethod: (method: PaymentMethod) => void;
  note: string;
  onNote: (note: string) => void;
  disabled?: boolean;
}

/**
 * Radio rather than checkboxes: it is one answer, and a set of checkboxes
 * invites two. The note field appears only for `other`.
 */
const PaymentMethodPicker = ({ name, method, onMethod, note, onNote, disabled }: Props) => {
  const { t } = useLang();

  return (
    <div className="col" style={{ gap: 6, marginTop: 6 }}>
      <strong style={{ fontSize: 13 }}>{t("session.payTitle")}</strong>
      <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
        {PAYMENT_METHODS.map((key) => (
          <label
            key={key}
            className="row"
            style={{ gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}
          >
            <input
              type="radio"
              name={name}
              value={key}
              checked={method === key}
              disabled={disabled}
              onChange={() => onMethod(key)}
            />
            <span>{t(LABEL_KEY[key])}</span>
          </label>
        ))}
      </div>
      {method === "other" && (
        <Input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={t("session.payOtherPlaceholder")}
          disabled={disabled}
        />
      )}
    </div>
  );
};

export default PaymentMethodPicker;
