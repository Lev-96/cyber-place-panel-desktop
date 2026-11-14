import type { IDbNotification } from "@/api/notifications";
import { useAuth } from "@/auth/AuthContext";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { billingNoticeContent, NOTICE_LANG, noticeKindOf } from "./billingNotice";

interface Props {
  n: IDbNotification;
  /** Open the invoice behind the notice (and mark it read). */
  onOpen: () => void;
  onDelete: () => void;
}

const MANDATORY = new Set(["overdue_d2", "restricted_d5", "suspended_d7"]);
const ICON: Record<string, string> = {
  reminder_d_minus_3: "🔔", due_today: "📅", overdue_d2: "⚠️", restricted_d5: "⛔", suspended_d7: "🚫",
  restored: "✅", payment_recorded: "✅", extended: "🗓",
};

/**
 * One Cyber Place Platform payment notice in the feed (2026-11-09).
 *
 * Read at a glance: a short title, one plain sentence, the figures that matter
 * as separate facts. The whole card opens the invoice. An owner reads it in
 * ARMENIAN whatever the panel's language (owner rule); an admin in the panel's
 * own language. The controls (Details, delete) follow the panel's language.
 */
const PlatformBillingNoticeCard = ({ n, onOpen, onDelete }: Props) => {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const noticeLang = user?.role === "admin" ? lang : NOTICE_LANG;
  const { title, sentence, facts } = billingNoticeContent(n, noticeLang);
  const kind = noticeKindOf(n);
  // Which club: an admin's feed holds every company's notices.
  const company = typeof n.data?.company_name === "string" ? n.data.company_name : null;
  const unread = n.read_at === null;
  const tone = kind && MANDATORY.has(kind) ? "danger" : kind === "restored" || kind === "payment_recorded" ? "ok" : "warn";

  return (
    <article
      className={`card billing-notice billing-notice--${tone}${unread ? " is-unread" : ""}`}
      data-notice-kind={kind ?? "unknown"}
    >
      <button type="button" className="billing-notice__open" onClick={onOpen} lang={noticeLang === "am" ? "hy" : noticeLang}>
        <span className="billing-notice__icon" aria-hidden="true">{kind ? ICON[kind] : "🔔"}</span>
        <span className="billing-notice__text">
          <span className="billing-notice__title">
            {unread && <span className="billing-notice__dot" aria-label={t("notifications.unreadDot")} />}
            {title}
          </span>
          {sentence && <span className="billing-notice__body">{sentence}</span>}
          <span className="billing-notice__facts">
            {facts.map((f) => (
              <span key={f.label} className="billing-notice__fact">
                <span className="billing-notice__fact-label">{f.label}</span>
                <span className="billing-notice__fact-value">{f.value}</span>
              </span>
            ))}
          </span>
          <span className="muted billing-notice__date">
            {[company, formatDateTime(n.created_at)].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>
      <div className="billing-notice__actions">
        <button type="button" className="btn secondary billing-notice__more" onClick={onOpen}>{t("platformBilling.details")}</button>
        <button
          type="button"
          className="billing-notice__delete"
          onClick={onDelete}
          aria-label={t("notifications.deleteOne")}
          title={t("notifications.deleteOne")}
        >
          ×
        </button>
      </div>
    </article>
  );
};

export default PlatformBillingNoticeCard;
