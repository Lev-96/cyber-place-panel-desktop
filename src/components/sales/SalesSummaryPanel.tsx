import { apiSalesSummary, type ISalesLine, type ISalesMethodRow, type SalesQuery } from "@/api/salesSummary";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { formatVenueDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useEffect, useState } from "react";
import { hoursLine, methodName, partsLine, periodLine, whereLine } from "./salesSummaryModel";

interface Props {
  branchId: number;
  /** `YYYY-MM-DD`: the business days, as the server counts them. */
  from: string;
  to: string;
  refreshKey?: number;
}

type Drill = { title: string; filter: Omit<SalesQuery, "date_from" | "date_to"> };

/**
 * «История продаж» in figures (2026-11-18, owner: the numbers must equal the
 * cash drawer 1:1). Every figure is the server's (`/sales-summary`), counted
 * by the same code as the shift report, over the branch's working day
 * (13:00 → 07:00); the panel adds nothing up itself. Each card opens the
 * records behind it: day and time, where, who, how it was paid.
 */
const SalesSummaryPanel = ({ branchId, from, to, refreshKey = 0 }: Props) => {
  const { t, money } = useLang();
  const [drill, setDrill] = useState<Drill | null>(null);
  const { data, loading, error, reload } = useAsync(
    () => apiSalesSummary(branchId, { date_from: from, date_to: to, per_page: 1 }),
    [branchId, from, to, refreshKey],
  );
  // Only a real answer is shown; anything else is an error, never zeros.
  const s = data?.data && typeof data.data === "object" && "totals" in data.data ? data.data : null;
  const m = (v: string) => money(Number(v));

  if (loading && !s) return <ListSkeleton />;
  if (error && !s) return <ErrorState error={error} onRetry={() => void reload()} titleKey="sales.loadFailed" />;
  if (!s) return <ErrorState error={error ?? new Error("bad answer")} onRetry={() => void reload()} titleKey="sales.loadFailed" />;

  const methodCard = (row: ISalesMethodRow) => (
    <Card
      key={`${row.method}|${row.label ?? ""}`}
      k={methodName(row, t)}
      v={m(row.amount)}
      sub={fmt(t("sales.times"), row.count)}
      testId={`sales-method-${row.method}${row.label ? `-${row.label}` : ""}`}
      onOpen={() => setDrill({ title: methodName(row, t), filter: { method: row.method, ...(row.method === "other" ? { label: row.label ?? "" } : {}) } })}
    />
  );
  // Cash and card always (a zero says "none today"); every other row only when it took money.
  const methods = s.by_method.filter((r) => r.method === "cash" || r.method === "card" || r.count > 0);
  const cashRow = s.by_method.find((r) => r.method === "cash" && r.label === null);

  return (
    <section className="col sales-summary" data-testid="sales-summary">
      <div className="sales-summary__period">
        <strong data-testid="sales-period">{periodLine(s.window, t)}</strong>
        <span className="muted" data-testid="sales-hours">{hoursLine(s.window, t)}</span>
      </div>

      <div className="stat-grid">
        <Card k={t("sales.grand")} v={m(s.totals.grand_total)} sub={t("sales.grandHint")} big testId="sales-grand"
          onOpen={() => setDrill({ title: t("sales.grand"), filter: {} })} />
        <Card k={t("sales.places")} v={m(s.totals.places_total)} sub={fmt(t("sales.placesCount"), s.totals.places_count)} testId="sales-places"
          onOpen={() => setDrill({ title: t("sales.places"), filter: { kind: "place" } })} />
        <Card k={t("sales.till")} v={m(s.totals.till_total)} sub={fmt(t("sales.tillCount"), s.totals.till_count)} testId="sales-till"
          onOpen={() => setDrill({ title: t("sales.till"), filter: { kind: "till" } })} />
        <Card k={t("sales.products")} v={m(s.totals.products_total)} sub={fmt(t("sales.productsUnits"), s.totals.products_units)} testId="sales-products" />
      </div>

      <h4 className="sales-summary__subtitle">{t("sales.byMethod")}</h4>
      <div className="stat-grid">{methods.map(methodCard)}</div>
      {/* The drawer holds cash taken ahead for seats still running, less change
          given back: said only when it differs from the cash payments. */}
      {cashRow && s.drawer.net_cash !== cashRow.amount && (
        <p className="muted sales-summary__drawer" data-testid="sales-drawer">{fmt(t("sales.drawer"), m(s.drawer.net_cash))}</p>
      )}

      {drill && <SalesLinesDialog branchId={branchId} from={from} to={to} drill={drill} onClose={() => setDrill(null)} />}
    </section>
  );
};

const Card = ({ k, v, sub, big, testId, onOpen }: { k: string; v: string; sub?: string; big?: boolean; testId: string; onOpen?: () => void }) => {
  const inner = (
    <>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {sub && <span className="muted sales-card__sub">{sub}</span>}
    </>
  );
  return onOpen ? (
    <button type="button" className={`stat-tile sales-card${big ? " sales-card--big" : ""}`} onClick={onOpen} data-testid={testId}>{inner}</button>
  ) : (
    <div className="stat-tile sales-card" data-testid={testId}>{inner}</div>
  );
};

const PAGE = 100;

/** The records behind one card, oldest first, a page at a time. */
const SalesLinesDialog = ({ branchId, from, to, drill, onClose }: { branchId: number; from: string; to: string; drill: Drill; onClose: () => void }) => {
  const { t, money } = useLang();
  const [lines, setLines] = useState<ISalesLine[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiSalesSummary(branchId, { date_from: from, date_to: to, per_page: PAGE, page, ...drill.filter })
      .then(({ data }) => {
        if (!alive) return;
        setLines((prev) => (page === 1 ? data.lines : [...prev, ...data.lines]));
        setLastPage(data.lines_meta.last_page);
        setTotal(data.lines_meta.total);
        setFailed(null);
      })
      .catch((e) => { if (alive) setFailed(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [branchId, from, to, drill, page]);

  return (
    <Modal open onClose={onClose}>
      <div className="card col sales-lines" role="dialog" aria-modal="true" data-testid="sales-lines">
        <h3 style={{ margin: 0 }}>{drill.title}</h3>
        <span className="muted">{fmt(t("sales.linesCount"), total)}</span>
        {failed !== null && lines.length === 0 ? (
          <ErrorState error={failed} onRetry={() => setPage(1)} titleKey="sales.loadFailed" />
        ) : (
          <div className="sales-lines__list">
            {lines.length === 0 && !loading && <p className="muted">{t("sales.noLines")}</p>}
            {lines.map((l) => (
              <div key={`${l.kind}-${l.id}`} className="sales-line" data-testid={`sales-line-${l.kind}-${l.id}`}>
                <div className="sales-line__head">
                  <strong>{whereLine(l, t)}</strong>
                  <strong>{money(Number(l.amount))}</strong>
                </div>
                <span className="muted">
                  {l.at ? formatVenueDateTime(l.at) : "-"}
                  {" · "}
                  {l.staff?.name ?? t("sales.byNobody")}
                </span>
                <span className="sales-line__parts">{l.is_free ? t("sales.free") : partsLine(l, (n) => money(n), t)}</span>
              </div>
            ))}
            {loading && <ListSkeleton />}
          </div>
        )}
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          {page < lastPage && !loading && (
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} data-testid="sales-lines-more">{t("sales.more")}</Button>
          )}
          <Button onClick={onClose}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default SalesSummaryPanel;
