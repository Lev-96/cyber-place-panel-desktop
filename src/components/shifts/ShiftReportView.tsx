import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import type { DifferenceKind, IShift, IShiftReport } from "@/types/shifts";
import type { CSSProperties, ReactNode } from "react";
import { shiftAmount } from "@/shifts/cash";

/**
 * One shift's report, as the server computed it (2026-10-19): the live one of
 * an open shift, or the frozen one of a closed shift — the same layout, so
 * what a manager watches all night is what they sign at the end.
 *
 * Nothing here adds, subtracts or rounds a figure. Every amount is the
 * server's decimal string, turned into a number only to be formatted.
 * Revenue, expected cash and the difference are separate blocks with their
 * own labels; a shortage is said in words as well as in red, never by colour
 * alone.
 */
interface Props {
  shift: IShift;
  report: IShiftReport;
}

const KIND_KEY: Record<DifferenceKind, string> = {
  shortage: "shift.kind.shortage",
  surplus: "shift.kind.surplus",
  none: "shift.kind.none",
};

export const durationText = (seconds: number, t: (k: string) => string): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} ${t("time.hourShort")} ${m} ${t("time.minShort")}`;
};

const Row = ({ label, value, strong, muted, testId }: {
  label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; testId?: string;
}) => (
  <div className="row-between" style={rowStyle} data-testid={testId}>
    <span className={muted ? "muted" : undefined}>{label}</span>
    {strong ? <strong>{value}</strong> : <span>{value}</span>}
  </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="card col" style={{ gap: 2 }}>
    <h3 style={{ margin: "0 0 6px" }}>{title}</h3>
    {children}
  </div>
);

const ShiftReportView = ({ shift, report }: Props) => {
  const { t, money } = useLang();
  const m = (amount: string) => shiftAmount(money, amount);
  const closed = shift.status === "closed";
  const kind = report.cash.difference_kind;

  return (
    <div className="col" style={{ gap: 12 }} data-testid="shift-report">
      <Section title={closed ? t("shift.statusClosed") : t("shift.statusOpen")}>
        <Row label={t("shift.openedAt")} value={formatDateTime(report.period.opened_at)} />
        <Row label={closed ? t("shift.closedAt") : t("shift.now")} value={formatDateTime(report.period.to)} />
        <Row label={t("shift.duration")} value={durationText(report.period.duration_seconds, t)} />
        <Row label={t("shift.openedBy")} value={shift.opened_by?.name ?? ""} />
        {closed && <Row label={t("shift.closedBy")} value={report.closed?.closed_by.name ?? shift.closed_by?.name ?? ""} />}
      </Section>

      <Section title={t("shift.revenue")}>
        <Row
          label={<>{t("shift.revenuePlaces")} <span className="muted" style={{ fontSize: 12 }}>
            {fmt(t("shift.placesCounts"), report.places.closed_count, report.places.free_count)}</span></>}
          value={m(report.places.total)}
          testId="shift-revenue-places"
        />
        <Row
          label={<>{t("shift.revenueTill")} <span className="muted" style={{ fontSize: 12 }}>
            {fmt(t("shift.tillCounts"), report.till.paid_count)}</span></>}
          value={m(report.till.total)}
          testId="shift-revenue-till"
        />
        {report.tournaments.count > 0 && <Row label={t("shift.revenueTournaments")} value={m(report.tournaments.total)} />}
        {report.till.voided_count > 0 && (
          <Row muted label={fmt(t("shift.voided"), report.till.voided_count, m(report.till.voided_total))} value="" />
        )}
        <div style={divider} />
        <Row label={t("shift.revenueTotal")} value={m(report.revenue_total)} strong testId="shift-revenue-total" />
      </Section>

      <Section title={t("shift.byMethod")}>
        <Row label={t("session.payCash")} value={m(report.by_method.cash)} testId="shift-method-cash" />
        <Row label={t("session.payCard")} value={m(report.by_method.card)} />
        <Row label={t("session.payOther")} value={m(report.by_method.other)} />
        {Number(report.by_method.deposit) > 0 && <Row label={t("till.payDeposit")} value={m(report.by_method.deposit)} />}
        {Number(report.by_method.unrecorded) > 0 && <Row label={t("shift.methodUnrecorded")} value={m(report.by_method.unrecorded)} />}
      </Section>

      <Section title={t("shift.cash")}>
        <Row label={t("shift.cashOpening")} value={m(report.cash.opening)} />
        <Row label={`+ ${t("shift.cashPlaces")}`} value={m(report.cash.places)} />
        <Row label={`+ ${t("shift.cashTill")}`} value={m(report.cash.till)} />
        <div style={divider} />
        <Row label={t("shift.cashExpected")} value={m(report.cash.expected)} strong testId="shift-cash-expected" />
        {report.cash.counted !== undefined && (
          <>
            <Row label={t("shift.cashCounted")} value={m(report.cash.counted)} strong />
            <div
              className="row-between"
              style={{ ...rowStyle, color: kind === "shortage" ? "var(--color-danger)" : undefined }}
              data-testid="shift-difference"
            >
              <strong>{t("shift.difference")}: {kind ? t(KIND_KEY[kind]) : ""}</strong>
              <strong>{m(report.cash.difference ?? "0.00")}</strong>
            </div>
            {report.closed?.notes && <div className="muted" style={{ fontSize: 13 }}>{report.closed.notes}</div>}
          </>
        )}
      </Section>

      {(report.member_topups.count > 0 || report.places.running_count > 0 || report.warnings.length > 0) && (
        <div className="card col" style={{ gap: 6 }} data-testid="shift-warnings">
          {report.member_topups.count > 0 && (
            <span className="muted">{fmt(t("shift.topups"), report.member_topups.count, m(report.member_topups.total))}</span>
          )}
          {report.places.running_count > 0 && <span className="muted">{fmt(t("shift.running"), report.places.running_count)}</span>}
          {report.warnings.map((w) => (
            <span key={w} style={{ fontSize: 13 }}>⚠ {t(`shift.warn.${w}`)}</span>
          ))}
        </div>
      )}
    </div>
  );
};

const rowStyle: CSSProperties = { padding: "4px 0", gap: 12 };
const divider: CSSProperties = { borderTop: "1px solid var(--color-border, rgba(255,255,255,0.12))", margin: "6px 0" };

export default ShiftReportView;
