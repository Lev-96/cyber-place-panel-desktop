import { formatDateTime, formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { shiftAmount } from "@/shifts/cash";
import type { IShiftProductGroup, IShiftReport, IShiftStaffPart } from "@/types/shifts";
import { platformLabel } from "@/utils/platform";
import type { CSSProperties } from "react";
import { Row, Section, divider } from "./shiftReportParts";

/**
 * The v3 blocks of a shift report (2026-10-26): what was sold per product,
 * each person's own part, the places handed over, sales of earlier shifts
 * undone in this one, and what the system does not record.
 *
 * Every figure is the server's; nothing is added up here. A person's figures
 * overlap on purpose (a place one started and another closed is in both) and
 * each is labelled for what it is, so none reads as a share of a total.
 * A report frozen before v3 has none of these blocks and renders nothing.
 */
interface Props {
  report: IShiftReport;
  /** The person closing (or about to close) the shift: shown first. */
  closerId: number | null;
}

export const staffInOrder = (staff: readonly IShiftStaffPart[], closerId: number | null): IShiftStaffPart[] =>
  [...staff].sort((a, b) => Number(b.id === closerId) - Number(a.id === closerId));

const ShiftBreakdown = ({ report, closerId }: Props) => {
  const { t, money } = useLang();
  const m = (amount: string) => shiftAmount(money, amount);
  const names = new Map((report.staff ?? []).map((p) => [p.id, p.name]));

  return (
    <>
      {report.products && (
        <Section title={t("shift.products")} testId="shift-products">
          <ProductGroup title={t("shift.productsTill")} group={report.products.till} m={m} testId="shift-products-till" />
          <ProductGroup title={t("shift.productsPlaces")} hint={t("shift.productsPlacesRule")} group={report.products.places} m={m} testId="shift-products-places" />
          <div style={divider} />
          <Row
            label={<strong>{t("shift.productsTotal")}</strong>}
            hint={fmt(t("shift.productsUnits"), report.products.units)}
            value={m(report.products.total)}
            strong
            testId="shift-products-total"
          />
          {report.products.till_voided.rows.length > 0 && (
            <ProductGroup title={t("shift.productsVoided")} hint={t("shift.productsVoidedRule")} group={report.products.till_voided} m={m} muted testId="shift-products-voided" />
          )}
          {report.products.places_free.rows.length > 0 && (
            <ProductGroup title={t("shift.productsFree")} hint={t("shift.productsFreeRule")} group={report.products.places_free} m={m} muted testId="shift-products-free" />
          )}
        </Section>
      )}

      {report.staff && (
        <Section title={t("shift.staff")} testId="shift-staff">
          <span className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("shift.staffRule")}</span>
          {report.staff.length === 0 && <span className="muted">{t("shift.linesNone")}</span>}
          {staffInOrder(report.staff, closerId).map((p) => (
            <div key={p.id} style={personStyle} data-testid="shift-staff-person">
              <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong>{p.name}</strong>
                {p.id === closerId && <span className="muted" style={{ fontSize: 12 }}>{t("shift.staffCloser")}</span>}
              </div>
              <Row label={t("shift.staffTill")} hint={fmt(t("shift.staffTillHint"), p.till.count, p.till.units)} value={m(p.till.total)} />
              <Row
                label={t("shift.staffStarted")}
                hint={fmt(t("shift.staffStartedHint"), p.started.finished, p.started.running)}
                value={fmt(t("shift.staffStartedValue"), p.started.launches, p.started.seats)}
                testId="shift-staff-started"
              />
              <Row label={t("shift.staffStartedBilled")} hint={fmt(t("shift.countOnly"), p.started_billed.count)} value={m(p.started_billed.total)} />
              <Row label={t("shift.staffClosed")} hint={fmt(t("shift.staffClosedHint"), p.closed.count, m(p.closed.cash))} value={m(p.closed.total)} />
              {p.voided.count > 0 && (
                <Row muted label={t("shift.staffVoided")} hint={fmt(t("shift.countOnly"), p.voided.count)} value={m(p.voided.total)} />
              )}
            </div>
          ))}
        </Section>
      )}

      {report.handover && (
        <Section title={t("shift.handover")} testId="shift-handover">
          <span className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("shift.handoverRule")}</span>
          {report.handover.places.length === 0 && <span className="muted">{t("shift.handoverNone")}</span>}
          {report.handover.places.map((pl) => (
            <Row
              key={pl.session_id}
              label={`${pl.seat} · ${platformLabel(pl.platform)}${pl.paused ? ` · ${t("shift.handoverPaused")}` : ""}${pl.is_free ? ` · ${t("shift.free")}` : ""}`}
              hint={[
                pl.started_at ? fmt(t("shift.handoverSince"), formatTime(pl.started_at)) : "",
                pl.started_by ? pl.started_by.name : "",
              ].filter(Boolean).join(" · ")}
              value={pl.ends_at ? fmt(t("shift.handoverUntil"), formatTime(pl.ends_at)) : t("shift.handoverNoEnd")}
              testId="shift-handover-place"
            />
          ))}
        </Section>
      )}

      {report.voided_from_other_shifts && report.voided_from_other_shifts.count > 0 && (
        <Section title={t("shift.voidedElsewhere")} testId="shift-voided-elsewhere">
          <span className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("shift.voidedElsewhereRule")}</span>
          {report.voided_from_other_shifts.lines.map((l) => (
            <Row
              key={l.id}
              label={`${l.voided_at ? formatDateTime(l.voided_at) : ""}${l.voided_by_id !== null && names.has(l.voided_by_id) ? ` · ${names.get(l.voided_by_id)}` : ""}`}
              hint={l.sold_at ? fmt(t("shift.voidedElsewhereSold"), formatDateTime(l.sold_at)) : undefined}
              value={m(l.amount)}
            />
          ))}
        </Section>
      )}

      {report.not_tracked && report.not_tracked.length > 0 && (
        <section className="card col" style={{ gap: 4 }} data-testid="shift-not-tracked">
          <strong style={{ fontSize: 13 }}>{t("shift.notTracked")}</strong>
          {report.not_tracked.map((k) => (
            <span key={k} className="muted" style={{ fontSize: 13 }}>• {t(`shift.notTracked.${k}`)}</span>
          ))}
        </section>
      )}
    </>
  );
};

const ProductGroup = ({ title, hint, group, m, muted, testId }: {
  title: string; hint?: string; group: IShiftProductGroup; m: (a: string) => string; muted?: boolean; testId?: string;
}) => {
  const { t } = useLang();
  return (
    <div className="col" style={{ gap: 0, marginTop: 6 }} data-testid={testId}>
      <div className="row-between" style={{ alignItems: "baseline" }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <strong style={{ fontSize: 13 }}>{m(group.total)}</strong>
      </div>
      {hint && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
      {group.rows.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{t("shift.linesNone")}</span>}
      {group.rows.map((r) => (
        <Row
          key={`${r.product_id ?? r.name}@${r.unit_price}`}
          muted={muted}
          label={r.name}
          hint={fmt(t("shift.productQty"), r.quantity, m(r.unit_price))}
          value={m(r.total)}
        />
      ))}
      {group.rows.length > 0 && (
        <span className="muted" style={{ fontSize: 12 }}>{fmt(t("shift.productsUnits"), group.units)}</span>
      )}
    </div>
  );
};

const personStyle: CSSProperties = {
  padding: "10px 12px", borderRadius: 10, marginBottom: 8,
  background: "var(--color-surface-alt)", border: "1px solid var(--color-border)",
};

export default ShiftBreakdown;
