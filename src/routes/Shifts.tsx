import ShiftHistory from "@/components/shifts/ShiftHistory";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { useSearchParams } from "react-router-dom";

/**
 * Смены — every shift this account may see, across branches (2026-10-19).
 *
 * An owner (and an admin) filters by branch, then by the branch's staff, by
 * dates, status and how the till came out; a manager sees the shifts they
 * opened or closed. Opening and closing happen on the branch's own shift
 * screen; this one is for looking back.
 *
 * `?shift_id=N` (2026-11-18, the shortage notification's link) opens that
 * shift's report at once; closing it drops the parameter.
 */
const Shifts = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const linked = Number(params.get("shift_id"));
  const openShiftId = Number.isInteger(linked) && linked > 0 ? linked : undefined;

  return (
    <div className="col" style={{ gap: 18 }}>
      <h2 className="page-title" style={{ margin: 0 }}>{t("nav.shifts")}</h2>
      <ShiftHistory
        canPickStaff={user?.role !== "manager"}
        openShiftId={openShiftId}
        onReportClosed={() => setParams((p) => { p.delete("shift_id"); return p; }, { replace: true })}
      />
    </div>
  );
};

export default Shifts;
