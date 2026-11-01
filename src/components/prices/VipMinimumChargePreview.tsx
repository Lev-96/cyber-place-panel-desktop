import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { IMinimumChargeRule } from "@/types/sessions";
import { ExampleRow, durationLabel, exampleMinutes, exampleRow, moveExample } from "./vipMinimumCharge";

interface Props {
  rule: IMinimumChargeRule;
  /** The VIP hourly rate the examples are priced at. */
  rate: number;
}

/**
 * What a VIP visit would pay under the rule being edited, recomputed as it is
 * edited, with the reason beside each figure ("по факту", "минимум 1 ч", …) so
 * an owner reads the rule off the table instead of decoding it. Priced with
 * the till's own function (see `exampleRow`), so the preview cannot promise
 * what the till would not charge. Ends with a moved visit, the case that
 * must neither reset the threshold nor charge the minimum twice.
 */
const VipMinimumChargePreview = ({ rule, rate }: Props) => {
  const { t, money } = useLang();
  const reason = (row: ExampleRow) => {
    switch (row.reason) {
      case "played": return t("vipMin.reason.played");
      case "perMinute": return t("vipMin.reason.perMinute");
      case "minimum": return fmt(t("vipMin.reason.minimum"), durationLabel(row.billedMinutes, t));
      case "roundedUp": return fmt(t("vipMin.reason.roundedUp"), durationLabel(row.billedMinutes, t));
    }
  };
  const rows = exampleMinutes(rule).map((minutes) => exampleRow(rule, rate, minutes));
  const move = moveExample(rule, rate);

  return (
    <div className="col" style={{ gap: 10 }}>
      <table className="vip-min-preview">
        <thead>
          <tr>
            <th>{t("vipMin.preview.played")}</th>
            <th>{t("vipMin.preview.pays")}</th>
            <th>{t("vipMin.preview.why")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playedMinutes} data-applied={row.reason === "minimum" || row.reason === "roundedUp" ? "1" : undefined}>
              <td>{durationLabel(row.playedMinutes, t)}</td>
              <td>{money(row.amount)}</td>
              <td className="vip-min-preview__why">{reason(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="vip-min-move" data-testid="vip-min-move">
        {fmt(
          t("vipMin.preview.move"),
          durationLabel(move.first, t),
          durationLabel(move.second, t),
          durationLabel(move.playedMinutes, t),
          money(move.amount),
          reason(move),
        )}
      </p>
    </div>
  );
};

export default VipMinimumChargePreview;
