import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import ShiftReportView from "@/components/shifts/ShiftReportView";
import { formatApiError } from "@/api/errors";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { shiftRepository } from "@/repositories/ShiftRepository";
import { shiftAmount } from "@/shifts/cash";
import type { DifferenceKind, IShift, IShiftWithReport, ShiftHistoryFilters } from "@/types/shifts";
import { useEffect, useMemo, useState } from "react";

/** "2026-10-19" (the date input's value) → "19.10.2026". */
const formatDate = (ymd: string): string => ymd.split("-").reverse().join(".");

/**
 * The shift history, filtered and paged on the server (2026-10-19).
 *
 * Every filter narrows the same request, so they work together. The staff
 * list follows the branch: it is the branch's own staff, re-read when the
 * branch changes, and a pick that does not belong to the new branch is
 * dropped. Any filter change starts again on page 1. Nothing is filtered in
 * the browser — a long history is never downloaded to be searched here.
 *
 * Who sees what is the server's answer: a manager gets the shifts they opened
 * or closed; an owner, every shift of their branches.
 */
interface Props {
  /** The branch screen fixes the branch; the company screen lets it be picked. */
  fixedBranchId?: number;
  /** Owners and admins pick a staff member; a manager's history is already theirs. */
  canPickStaff: boolean;
}

const PER_PAGE = 20;

const KIND_KEY: Record<DifferenceKind, string> = {
  shortage: "shift.kind.shortage",
  surplus: "shift.kind.surplus",
  none: "shift.kind.none",
};

export const branchLabel = (b: { address?: string | null; city?: string | null } | null | undefined): string =>
  b ? [b.address, b.city].filter(Boolean).join(", ") : "";

const ShiftHistory = ({ fixedBranchId, canPickStaff }: Props) => {
  const { t, money } = useLang();
  const [branchId, setBranchId] = useState<number | undefined>(fixedBranchId);
  const [staffId, setStaffId] = useState<number | undefined>(undefined);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<ShiftHistoryFilters["status"]>(undefined);
  const [discrepancy, setDiscrepancy] = useState<ShiftHistoryFilters["discrepancy"]>(undefined);
  const [viewing, setViewing] = useState<IShiftWithReport | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const branches = useAsync(
    () => (fixedBranchId ? Promise.resolve([]) : branchRepository.list()),
    [fixedBranchId],
  );
  const staff = useAsync(
    () => (canPickStaff && branchId ? shiftRepository.staff(branchId) : Promise.resolve([])),
    [canPickStaff, branchId],
  );

  // A staff member who does not work at the newly picked branch is dropped.
  useEffect(() => {
    if (staffId === undefined || staff.loading || !staff.data) return;
    if (!staff.data.some((s) => s.id === staffId)) setStaffId(undefined);
  }, [staff.data, staff.loading, staffId]);

  const filters: ShiftHistoryFilters = useMemo(() => ({
    branch_id: branchId,
    staff_user_id: canPickStaff && branchId ? staffId : undefined,
    date_from: from || undefined,
    date_to: to || undefined,
    status,
    discrepancy,
  }), [branchId, staffId, canPickStaff, from, to, status, discrepancy]);

  // Any filter change goes back to page 1, without a reset effect.
  const key = JSON.stringify(filters);
  const [paging, setPaging] = useState({ key, page: 1 });
  const page = paging.key === key ? paging.page : 1;

  const list = useAsync(
    () => shiftRepository.list({ ...stripEmpty(filters), page, per_page: PER_PAGE }),
    [key, page],
  );
  const lastPage = list.data?.meta?.last_page ?? 1;

  const reset = () => {
    if (!fixedBranchId) setBranchId(undefined);
    setStaffId(undefined);
    setFrom("");
    setTo("");
    setStatus(undefined);
    setDiscrepancy(undefined);
  };
  const active = (fixedBranchId ? 0 : Number(branchId !== undefined)) + Number(staffId !== undefined)
    + Number(from !== "") + Number(to !== "") + Number(status !== undefined) + Number(discrepancy !== undefined);

  // What is on, said in words, each removable on its own.
  const branchName = (branches.data ?? []).find((b) => b.id === branchId);
  const staffName = (staff.data ?? []).find((u) => u.id === staffId)?.name;
  const chips: Array<{ key: string; label: string; clear: () => void }> = [
    ...(!fixedBranchId && branchId !== undefined
      ? [{ key: "branch", label: `${t("shift.filter.branch")}: ${branchName ? branchLabel(branchName) : `№${branchId}`}`, clear: () => setBranchId(undefined) }] : []),
    ...(staffId !== undefined && staffName ? [{ key: "staff", label: `${t("shift.filter.staff")}: ${staffName}`, clear: () => setStaffId(undefined) }] : []),
    ...(from ? [{ key: "from", label: `${t("shift.filter.from")}: ${formatDate(from)}`, clear: () => setFrom("") }] : []),
    ...(to ? [{ key: "to", label: `${t("shift.filter.to")}: ${formatDate(to)}`, clear: () => setTo("") }] : []),
    ...(status ? [{ key: "status", label: `${t("shift.filter.status")}: ${t(status === "open" ? "shift.statusOpen" : "shift.statusClosed")}`, clear: () => setStatus(undefined) }] : []),
    ...(discrepancy ? [{ key: "diff", label: `${t("shift.difference")}: ${t(discrepancy === "any" ? "shift.filter.anyDifference" : KIND_KEY[discrepancy])}`, clear: () => setDiscrepancy(undefined) }] : []),
  ];

  const showReport = async (shift: IShift) => {
    setOpening(shift.id);
    setErr(null);
    try {
      setViewing(await shiftRepository.summary(shift.id));
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setOpening(null);
    }
  };

  const difference = (s: IShift) =>
    s.difference_kind === null
      ? ""
      : `${t(KIND_KEY[s.difference_kind])}${s.difference_kind === "none" || s.cash_difference === null ? "" : `: ${shiftAmount(money, s.cash_difference)}`}`;

  return (
    <div className="col" style={{ gap: 10 }} data-testid="shift-history">
      <div className="card row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {!fixedBranchId && (
          <label className="col" style={{ gap: 4, minWidth: 200 }}>
            <span className="label">{t("shift.filter.branch")}</span>
            <select
              className="input"
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
              data-testid="shift-filter-branch"
            >
              <option value="">{t("shift.filter.allBranches")}</option>
              {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{branchLabel(b)}</option>)}
            </select>
          </label>
        )}
        {canPickStaff && (
          <label className="col" style={{ gap: 4, minWidth: 200 }}>
            <span className="label">{t("shift.filter.staff")}</span>
            <select
              className="input"
              value={staffId ?? ""}
              disabled={!branchId}
              title={!branchId ? t("shift.filter.pickBranchFirst") : undefined}
              onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : undefined)}
              data-testid="shift-filter-staff"
            >
              <option value="">{branchId ? t("shift.filter.allStaff") : t("shift.filter.pickBranchFirst")}</option>
              {(staff.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("shift.filter.from")}</span>
          <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} data-testid="shift-filter-from" />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("shift.filter.to")}</span>
          <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} data-testid="shift-filter-to" />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("shift.filter.status")}</span>
          <select className="input" value={status ?? ""} onChange={(e) => setStatus((e.target.value || undefined) as ShiftHistoryFilters["status"])} data-testid="shift-filter-status">
            <option value="">{t("shift.filter.any")}</option>
            <option value="open">{t("shift.statusOpen")}</option>
            <option value="closed">{t("shift.statusClosed")}</option>
          </select>
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("shift.difference")}</span>
          <select className="input" value={discrepancy ?? ""} onChange={(e) => setDiscrepancy((e.target.value || undefined) as ShiftHistoryFilters["discrepancy"])} data-testid="shift-filter-discrepancy">
            <option value="">{t("shift.filter.any")}</option>
            <option value="any">{t("shift.filter.anyDifference")}</option>
            <option value="shortage">{t("shift.kind.shortage")}</option>
            <option value="surplus">{t("shift.kind.surplus")}</option>
            <option value="none">{t("shift.kind.none")}</option>
          </select>
        </label>
        {active > 0 && (
          <Button variant="secondary" onClick={reset} data-testid="shift-filter-reset">
            {t("shift.filter.reset")} ({active})
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} data-testid="shift-filter-chips">
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip" style={chip} onClick={c.clear} aria-label={`${t("shift.filter.remove")}: ${c.label}`}>
              {c.label} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
      {list.data?.meta && (
        <span className="muted" style={{ fontSize: 12 }} data-testid="shift-history-total">
          {t("shift.filter.found")}: {list.data.meta.total}
        </span>
      )}

      <StateSwitch
        view={deriveViewState({ loading: list.loading, error: list.error, data: list.data?.data })}
        skeleton={<ListSkeleton />}
        onRetry={() => void list.reload()}
        error={{ titleKey: "shift.state.errorTitle" }}
        empty={{ titleKey: active > 0 ? "shift.filter.noMatch" : "shift.historyEmpty", descriptionKey: null }}
      >
        <div className="list">
          {(list.data?.data ?? []).map((s) => (
            <div key={s.id} className="list-item" data-testid="shift-history-row">
              <div style={{ minWidth: 0 }}>
                <div className="name">
                  {formatDateTime(s.opened_at)}{s.closed_at ? ` → ${formatDateTime(s.closed_at)}` : ""}
                  {" · "}{s.status === "open" ? t("shift.statusOpen") : t("shift.statusClosed")}
                  {!fixedBranchId && s.branch ? ` · ${branchLabel(s.branch)}` : ""}
                </div>
                <div className="meta">
                  {t("shift.openedBy")}: {s.opened_by?.name ?? ""}
                  {s.closed_by ? ` · ${t("shift.closedBy")}: ${s.closed_by.name}` : ""}
                  {s.revenue_total !== null ? ` · ${t("shift.revenueTotal")}: ${shiftAmount(money, s.revenue_total)}` : ""}
                  {s.expected_cash !== null ? ` · ${t("shift.cashExpected")}: ${shiftAmount(money, s.expected_cash)}` : ""}
                  {s.counted_cash !== null ? ` · ${t("shift.cashCounted")}: ${shiftAmount(money, s.counted_cash)}` : ""}
                </div>
                {difference(s) && (
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: s.difference_kind === "shortage" ? "var(--color-danger)" : undefined }}
                    data-testid="shift-history-difference"
                  >
                    {s.difference_kind === "shortage" ? "⚠ " : ""}{difference(s)}
                  </div>
                )}
              </div>
              <Button variant="secondary" onClick={() => void showReport(s)} disabled={opening !== null}>
                {opening === s.id ? "…" : t("shift.report")}
              </Button>
            </div>
          ))}
        </div>
      </StateSwitch>

      <Pagination page={page} lastPage={lastPage} onChange={(p) => setPaging({ key, page: p })} disabled={list.loading} />

      {viewing && (
        <Modal open onClose={() => setViewing(null)}>
          <div className="card" style={{ width: 680, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }} data-testid="shift-report-modal">
            <h2 style={{ margin: 0 }}>
              {viewing.shift.status === "closed" ? t("shift.closedTitle") : t("shift.report")}
              {viewing.shift.branch ? ` · ${branchLabel(viewing.shift.branch)}` : ""}
            </h2>
            {viewing.report
              ? <ShiftReportView shift={viewing.shift} report={viewing.report} />
              : <span className="muted">{t("shift.noReport")}</span>}
            <div className="row-between">
              <span />
              <Button onClick={() => setViewing(null)}>{t("action.close")}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const chip: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
  background: "var(--color-surface-alt)", color: "var(--color-text)", border: "1px solid var(--color-border)",
};

const stripEmpty = (f: ShiftHistoryFilters): ShiftHistoryFilters =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")) as ShiftHistoryFilters;

export default ShiftHistory;
