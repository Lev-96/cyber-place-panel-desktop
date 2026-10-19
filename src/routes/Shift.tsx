import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { SkeletonText } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import CloseShiftDialog from "@/components/shifts/CloseShiftDialog";
import ShiftHistory, { branchLabel } from "@/components/shifts/ShiftHistory";
import { useAuth } from "@/auth/AuthContext";
import { branchRepository } from "@/repositories/BranchRepository";
import ShiftReportView from "@/components/shifts/ShiftReportView";
import { formatApiError } from "@/api/errors";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { shiftRepository } from "@/repositories/ShiftRepository";
import { parseCents, toAmount } from "@/shifts/cash";
import type { IShiftWithReport } from "@/types/shifts";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

/**
 * Смена — the branch's cash shift (2026-10-19).
 *
 * No shift open: the opening cash and "Open shift". A shift open: its live
 * report (refreshed on demand and after every action; it is computed on the
 * server from the records the money was written in) and "Close shift", which
 * shows exactly what will be recorded before it is. Below, the history: every
 * shift with who opened and closed it and how the till came out; one opens its
 * saved report.
 *
 * Reading this screen never opens a shift, and a restart finds the open one
 * where it was: the server holds it, not this window. Closing a shift does
 * not touch Active Places — a running place stays running and is counted in
 * the shift in which it is closed.
 */

const Shift = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const { user } = useAuth();

  const current = useAsync(() => shiftRepository.current(id), [id]);
  const branch = useAsync(() => branchRepository.byId(id), [id]);
  // Bumped after an open or a close so the history below re-reads.
  const [historyKey, setHistoryKey] = useState(0);

  const [openingCash, setOpeningCash] = useState("");
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [viewing, setViewing] = useState<IShiftWithReport | null>(null);
  /** Synchronous guard: clicks arrive before the disabled button re-renders. */
  const openingNow = useRef(false);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const reloadAll = () => { void current.reload(); setHistoryKey((k) => k + 1); };
  const openingCents = openingCash.trim() === "" ? 0 : parseCents(openingCash);

  const open = async () => {
    if (opening || openingCents === null || openingNow.current) return;
    openingNow.current = true;
    setOpening(true);
    setErr(null);
    setNotice(null);
    try {
      await shiftRepository.open(id, toAmount(openingCents));
      setOpeningCash("");
    } catch (e) {
      // Somebody else opened it a moment ago: show theirs, do not fail.
      if ((e as { status?: number }).status === 409) setNotice(t("shift.alreadyOpen"));
      else setErr(formatApiError(e));
    } finally {
      openingNow.current = false;
      setOpening(false);
      reloadAll();
    }
  };

  const live = current.data;
  const isOpen = Boolean(live?.shift);

  // An open shift's figures are "as of" the last read: re-read every minute so
  // the duration and the money stay current. Paused while closing, so the
  // dialog's figures are the ones the cashier is looking at.
  useEffect(() => {
    if (!isOpen || closing) return;
    const timer = setInterval(() => { void current.reload(); }, 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, closing]);

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>
          {t("shift.title")} · {branch.data ? branchLabel(branch.data) : `№${id}`}
        </h2>
        {live?.shift && (
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={reloadAll} disabled={current.loading}>{t("action.refresh")}</Button>
            <Button onClick={() => setClosing(true)} disabled={!live.report} data-testid="shift-close">{t("shift.close")}</Button>
          </div>
        )}
      </div>

      {notice && <div className="card muted">{notice}</div>}
      {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}

      <StateSwitch
        view={deriveViewState({ loading: current.loading, error: current.error, data: current.data })}
        skeleton={<SkeletonText lines={6} />}
        onRetry={() => void current.reload()}
        error={{ titleKey: "shift.state.errorTitle" }}
      >
        {live?.shift && live.report ? (
          <ShiftReportView shift={live.shift} report={live.report} />
        ) : (
          <div className="card col" style={{ gap: 10, maxWidth: 520 }} data-testid="shift-none">
            <strong>{t("shift.none")}</strong>
            <span className="muted" style={{ fontSize: 13 }}>{t("shift.noneHint")}</span>
            <Input
              label={t("shift.openingCash")}
              inputMode="decimal"
              placeholder="0"
              value={openingCash}
              onChange={(e) => { setOpeningCash(e.target.value); setErr(null); }}
              disabled={opening}
              data-testid="shift-opening-cash"
            />
            {openingCents === null && <span className="error" style={{ fontSize: 12 }}>{t("shift.countedInvalid")}</span>}
            <div>
              <Button onClick={() => void open()} disabled={opening || openingCents === null} data-testid="shift-open">
                {opening ? t("shift.opening") : t("shift.open")}
              </Button>
            </div>
          </div>
        )}
      </StateSwitch>

      <div className="col" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{t("shift.history")}</h3>
        <ShiftHistory key={historyKey} fixedBranchId={id} canPickStaff={user?.role !== "manager"} />
      </div>

      {closing && live?.shift && live.report && (
        <CloseShiftDialog
          shift={live.shift}
          report={live.report}
          onClose={() => setClosing(false)}
          onClosed={(result) => {
            setClosing(false);
            setNotice(result.already_closed ? t("shift.alreadyClosed") : null);
            setViewing(result);
            reloadAll();
          }}
        />
      )}

      {viewing && (
        <Modal open onClose={() => setViewing(null)}>
          <div className="card" style={{ width: 640, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }} data-testid="shift-report-modal">
            <h2 style={{ margin: 0 }}>{viewing.shift.status === "closed" ? t("shift.closedTitle") : t("shift.report")}</h2>
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

export default Shift;
