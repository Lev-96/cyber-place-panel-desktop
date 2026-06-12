import { IServiceExpense } from "@/api/expenses";
import { dueLabel } from "@/components/expenses/expenseFormat";
import { useAuth } from "@/auth/AuthContext";
import { formatAmount } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";
import { expenseRepository } from "@/repositories/ExpenseRepository";
import { showDesktopNotification } from "@/utils/desktopNotification";
import { playNotificationChime } from "@/utils/notificationSound";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * App-shell-level reminder for the admin's recurring-service payments.
 *
 * Admin-only by product — only the admin tracks platform expenses, so
 * only the admin is nagged (mirrors the `menu.expenses` permission and
 * the admin gate on the Notifications reminders feed). There is no
 * scheduler or Reverb feed for expenses: the backend computes the
 * "due within 3 days (or overdue)" list on demand, so this polls
 * `/admin/service-expenses/reminders` and announces each service the
 * first time it enters the due window — a chime + an OS push + a corner
 * toast, the same three channels the booking notifier uses.
 *
 * De-dup: `announcedRef` holds the ids already rung this session, so a
 * service only chimes once. An id that leaves the window (the admin
 * marked it paid → next month) is forgotten, so it rings again when it
 * next comes due. One chime per poll cycle even if several services
 * fall due together — no cacophony.
 */
const POLL_MS = 60_000;
const AUTO_DISMISS_MS = 10_000;

const ExpenseReminderNotifier = () => {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const announcedRef = useRef<Set<number>>(new Set());
  const aliveRef = useRef(true);
  const [toast, setToast] = useState<IServiceExpense[] | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const announce = useCallback(
    (fresh: IServiceExpense[]) => {
      // One chime for the whole batch; an OS push per service so each is
      // individually actionable from the OS tray; one combined in-app toast.
      playNotificationChime();
      for (const e of fresh) {
        const body = `${e.name} · ${dueLabel(e.days_until_due, t)} · ${formatAmount(e.amount, e.currency, lang)}`;
        showDesktopNotification(
          t("expenses.reminderPushTitle"),
          { body, tag: `expense-due-${e.id}` },
          () => {
            try {
              window.focus();
            } catch {
              /* not always allowed */
            }
            navigate("/expenses");
          },
        );
      }
      setToast(fresh);
    },
    [navigate, t, lang],
  );

  const poll = useCallback(async () => {
    if (!isAdmin) return;
    let due: IServiceExpense[];
    try {
      due = await expenseRepository.reminders(3);
    } catch {
      return; // network blip — keep state, next tick retries
    }
    if (!aliveRef.current) return;

    const fresh = due.filter((e) => !announcedRef.current.has(e.id));
    // Remember the current due set (announced + still-pending); ids that
    // dropped out are forgotten so they can ring again next month.
    announcedRef.current = new Set(due.map((e) => e.id));
    if (fresh.length > 0) announce(fresh);
  }, [isAdmin, announce]);

  // Initial poll on mount + 60s interval; re-arms when the role flips to
  // admin (login). Non-admins never poll and never ring.
  useEffect(() => {
    if (!isAdmin) {
      announcedRef.current = new Set();
      setToast(null);
      return;
    }
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [isAdmin, poll]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast || toast.length === 0) return null;

  const many = toast.length > 1;
  const headline = many
    ? t("expenses.reminderToastMany").replace("{n}", String(toast.length))
    : `${toast[0].name} — ${dueLabel(toast[0].days_until_due, t)}`;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9000,
        maxWidth: 360,
        borderRadius: 8,
        background: "rgba(245, 158, 11, 0.16)",
        borderLeft: "4px solid #f59e0b",
        padding: "12px 14px",
        boxShadow: "0 6px 22px rgba(0, 0, 0, 0.35)",
        color: "#e5e7eb",
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        ⏰ {t("expenses.reminderPushTitle")}
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        {headline}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => {
            setToast(null);
            navigate("/expenses");
          }}
          style={toastBtn}
        >
          {t("expenses.openExpenses")}
        </button>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Dismiss"
          style={{ ...toastBtn, marginLeft: "auto", color: "#9ca3af" }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

const toastBtn: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #1f2a44",
  borderRadius: 6,
  background: "transparent",
  color: "#e5e7eb",
  cursor: "pointer",
  fontSize: 12,
};

export default ExpenseReminderNotifier;
