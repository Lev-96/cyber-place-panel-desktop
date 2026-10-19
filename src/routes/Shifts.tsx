import ShiftHistory from "@/components/shifts/ShiftHistory";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Смены — every shift this account may see, across branches (2026-10-19).
 *
 * An owner (and an admin) filters by branch, then by the branch's staff, by
 * dates, status and how the till came out; a manager sees the shifts they
 * opened or closed. Opening and closing happen on the branch's own shift
 * screen; this one is for looking back.
 */
const Shifts = () => {
  const { t } = useLang();
  const { user } = useAuth();

  return (
    <div className="col" style={{ gap: 18 }}>
      <h2 className="page-title" style={{ margin: 0 }}>{t("nav.shifts")}</h2>
      <ShiftHistory canPickStaff={user?.role !== "manager"} />
    </div>
  );
};

export default Shifts;
