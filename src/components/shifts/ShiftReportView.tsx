import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import type { DifferenceKind, IShift, IShiftReport } from "@/types/shifts";
import type { CSSProperties, ReactNode } from "react";
import { shiftAmount } from "@/shifts/cash";
import { platformLabel } from "@/utils/platform";

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

const Row = ({ label, hint, value, strong, muted, testId }: {
  label: ReactNode; hint?: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; testId?: string;
}) => (
  <div className="row-between" style={rowStyle} data-testid={testId}>
    {/* The count sits under the label, never beside the amount: "продаж: 2"
        printed next to "3 000" read as "23 000" (2026-10-19). */}
    <span className={muted ? "muted" : undefined} style={{ minWidth: 0 }}>
      {label}
      {hint !== undefined && <span className="muted" style={hintStyle}>{hint}</span>}
    </span>
    {strong ? <strong style={valueStyle}>{value}</strong> : <span style={valueStyle}>{value}</span>}
  </div>
);

const Section = ({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) => (
  <section className="card col" style={{ gap: 2, minWidth: 0 }} data-testid={testId}>
    <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{title}</h3>
    {children}
  </section>
);

/** One fact of the header: its name above it, so two never run together. */
const Fact = ({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) => (
  <div className="col" style={{ gap: 2, minWidth: 0 }} data-testid={testId}>
    <span className="muted" style={{ fontSize: 12 }}>{label}</span>
    <span style={{ fontWeight: 600 }}>{children}</span>
  </div>
);

const ShiftReportView = ({ shift, report }: Props) => {
  const { t, money } = useLang();
  const methodName = (method: string) =>
    method === "cash" ? t("session.payCash") : method === "card" ? t("session.payCard")
      : method === "deposit" ? t("till.payDeposit") : method === "other" ? t("session.payOther") : t("shift.methodUnrecorded");

  const m = (amount: string) => shiftAmount(money, amount);
  const closed = shift.status === "closed";
  const kind = report.cash.difference_kind;
  const branch = shift.branch ? [shift.branch.address, shift.branch.city].filter(Boolean).join(", ") : "";

  return (
    <div className="col" style={{ gap: 12 }} data-testid="shift-report">
      <section className="card col" style={{ gap: 14 }} data-testid="shift-header">
        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ ...pill, ...(closed ? pillClosed : pillOpen) }} data-testid="shift-status">
            {closed ? t("shift.headerClosed") : t("shift.headerOpen")}
          </span>
          {branch && <span className="muted">{branch}</span>}
        </div>
        <div style={factsGrid}>
          <Fact label={t("shift.openedAt")}>{formatDateTime(report.period.opened_at)}</Fact>
          <Fact label={closed ? t("shift.closedAt") : t("shift.asOf")}>{formatDateTime(report.period.to)}</Fact>
          <Fact label={t("shift.duration")} testId="shift-duration">{durationText(report.period.duration_seconds, t)}</Fact>
          <Fact label={t("shift.openedBy")}>{shift.opened_by?.name ?? ""}</Fact>
          {closed && <Fact label={t("shift.closedBy")}>{report.closed?.closed_by.name ?? shift.closed_by?.name ?? ""}</Fact>}
        </div>
      </section>

      <section className="card col" style={{ gap: 12 }}>
        <div className="col" style={{ gap: 2 }} data-testid="shift-revenue-total">
          <span className="muted" style={{ fontSize: 13 }}>{t("shift.revenueTotal")}</span>
          <strong style={{ fontSize: 32, lineHeight: 1.1 }}>{m(report.revenue_total)}</strong>
          <span className="muted" style={{ fontSize: 12 }}>{t("shift.revenueRule")}</span>
        </div>
        <div style={partsGrid}>
          <Part
            label={t("shift.revenuePlaces")}
            value={m(report.places.total)}
            hint={fmt(t("shift.placesCounts"), report.places.closed_count, report.places.free_count)}
            testId="shift-revenue-places"
          />
          <Part
            label={t("shift.revenueTill")}
            value={m(report.till.total)}
            hint={fmt(t("shift.tillCounts"), report.till.paid_count)}
            testId="shift-revenue-till"
          />
          {report.tournaments.count > 0 && (
            <Part label={t("shift.revenueTournaments")} value={m(report.tournaments.total)} hint={fmt(t("shift.tournamentsCount"), report.tournaments.count)} />
          )}
        </div>
        {report.till.voided_count > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>{fmt(t("shift.voided"), report.till.voided_count, m(report.till.voided_total))}</span>
        )}
      </section>

      <div style={twoCols}>
        <Section title={t("shift.byMethod")}>
          <Row label={t("session.payCash")} value={m(report.by_method.cash)} testId="shift-method-cash" />
          <Row label={t("session.payCard")} value={m(report.by_method.card)} />
          <Row label={t("session.payOther")} value={m(report.by_method.other)} />
          {Number(report.by_method.deposit) > 0 && <Row label={t("till.payDeposit")} value={m(report.by_method.deposit)} />}
          {Number(report.by_method.unrecorded) > 0 && <Row label={t("shift.methodUnrecorded")} value={m(report.by_method.unrecorded)} />}
          <div style={divider} />
          <Row muted label={t("shift.byMethodTotal")} value={m(report.revenue_total)} />
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
                style={{ ...rowStyle, color: kind === "shortage" ? "var(--color-danger)" : kind === "surplus" ? "var(--color-warning)" : undefined }}
                data-testid="shift-difference"
              >
                <strong>{kind === "shortage" ? "⚠ " : ""}{t("shift.difference")}: {kind ? t(KIND_KEY[kind]) : ""}</strong>
                <strong style={valueStyle}>{m(report.cash.difference ?? "0.00")}</strong>
              </div>
              {report.closed?.notes && <div className="muted" style={{ fontSize: 13 }}>{report.closed.notes}</div>}
            </>
          )}
          <span className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t("shift.cashRule")}</span>
        </Section>
      </div>

      {(report.places.unique_seats !== undefined || report.bookings) && (
        <Section title={t("shift.activity")}>
          {report.places.unique_seats !== undefined && (
            <Row label={t("shift.seatsUsed")} value={fmt(t("shift.seatsUsedValue"), report.places.unique_seats, report.places.closed_count)} testId="shift-seats" />
          )}
          {(report.places.by_platform ?? []).map((p) => (
            <Row key={p.platform} muted label={`${platformLabel(p.platform)} · ${p.count}`} value={m(p.total)} />
          ))}
          {report.bookings && (
            <>
              <div style={divider} />
              <Row label={t("shift.bookingsCreated")} value={report.bookings.created_count} testId="shift-bookings-created" />
              <Row label={t("shift.bookingsServed")} value={report.bookings.served_count} />
              <Row label={t("shift.bookingsCancelled")} value={fmt(t("shift.bookingsCancelledValue"), report.bookings.cancelled_count, report.bookings.no_show_count)} />
              <Row
                label={t("shift.bookingsScheduled")}
                value={fmt(t("shift.bookingsScheduledValue"), report.bookings.scheduled.count, report.bookings.scheduled.served, report.bookings.scheduled.cancelled, report.bookings.scheduled.open)}
                testId="shift-bookings-scheduled"
              />
            </>
          )}
        </Section>
      )}

      {(report.member_topups.count > 0 || report.places.running_count > 0 || report.warnings.length > 0) && (
        <section className="card col" style={{ gap: 6, borderColor: "var(--color-warning)" }} data-testid="shift-warnings">
          {report.warnings.map((w) => (
            <span key={w} style={{ fontSize: 13 }}>⚠ {t(`shift.warn.${w}`)}</span>
          ))}
          {report.places.running_count > 0 && <span className="muted">{fmt(t("shift.running"), report.places.running_count)}</span>}
          {(report.places.paused_count ?? 0) > 0 && <span className="muted">{fmt(t("shift.paused"), report.places.paused_count ?? 0)}</span>}
          {report.member_topups.count > 0 && (
            <span className="muted">{fmt(t("shift.topups"), report.member_topups.count, m(report.member_topups.total))}</span>
          )}
        </section>
      )}

      {report.lines && (
        <details className="card" data-testid="shift-lines">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t("shift.lines")}</summary>
          <div className="col" style={{ gap: 2, marginTop: 10, fontSize: 13 }}>
            <LinesHead title={t("shift.revenuePlaces")} rule={t("shift.linesRule.places")} total={m(report.places.total)} />
            {report.lines.places.length === 0 && <span className="muted">{t("shift.linesNone")}</span>}
            {report.lines.places.map((l) => (
              <Row key={`p${l.id}`} label={`${l.closed_at ? formatDateTime(l.closed_at) : ""} · ${l.seat} · ${methodName(l.method)}${l.is_free ? ` · ${t("shift.free")}` : ""}`} value={m(l.amount)} />
            ))}
            <LinesHead title={t("shift.revenueTill")} rule={t("shift.linesRule.till")} total={m(report.till.total)} />
            {report.lines.till.length === 0 && <span className="muted">{t("shift.linesNone")}</span>}
            {report.lines.till.map((l) => (
              <Row key={`o${l.id}`} muted={l.status !== "paid"} label={`${l.at ? formatDateTime(l.at) : ""} · ${methodName(l.method)}${l.status !== "paid" ? ` · ${t("till.voided")}` : ""}`} value={m(l.amount)} />
            ))}
            {report.lines.tournaments.length > 0 && (
              <LinesHead title={t("shift.revenueTournaments")} rule={t("shift.linesRule.tournaments")} total={m(report.tournaments.total)} />
            )}
            {report.lines.tournaments.map((l) => (
              <Row key={`t${l.id}`} label={formatDateTime(l.paid_at)} value={m(l.amount)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

/** A part of the revenue: name, amount, and its count on a line of its own. */
const Part = ({ label, value, hint, testId }: { label: string; value: string; hint: string; testId?: string }) => (
  <div className="col" style={partStyle} data-testid={testId}>
    <span className="muted" style={{ fontSize: 12 }}>{label}</span>
    <strong style={{ fontSize: 18 }}>{value}</strong>
    <span className="muted" style={{ fontSize: 12 }}>{hint}</span>
  </div>
);

/** A composition group: what it is, why its records are in this shift, its total. */
const LinesHead = ({ title, rule, total }: { title: string; rule: string; total: string }) => (
  <div className="col" style={{ gap: 0, marginTop: 10, paddingBottom: 4, borderBottom: "1px solid var(--color-border)" }}>
    <div className="row-between"><strong>{title}</strong><strong>{total}</strong></div>
    <span className="muted" style={{ fontSize: 12 }}>{rule}</span>
  </div>
);

const rowStyle: CSSProperties = { padding: "5px 0", gap: 16, alignItems: "baseline" };
const hintStyle: CSSProperties = { display: "block", fontSize: 12 };
const valueStyle: CSSProperties = { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const divider: CSSProperties = { borderTop: "1px solid var(--color-border, rgba(255,255,255,0.12))", margin: "6px 0" };
const factsGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 };
const partsGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 };
const twoCols: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, alignItems: "start" };
const partStyle: CSSProperties = {
  gap: 2, padding: "10px 12px", borderRadius: 10,
  background: "var(--color-surface-alt)", border: "1px solid var(--color-border)",
};
const pill: CSSProperties = { padding: "4px 12px", borderRadius: 999, fontWeight: 700, fontSize: 13, border: "1px solid" };
const pillOpen: CSSProperties = { color: "var(--color-success)", borderColor: "var(--color-success)" };
const pillClosed: CSSProperties = { color: "var(--color-muted)", borderColor: "var(--color-border)" };

export default ShiftReportView;
