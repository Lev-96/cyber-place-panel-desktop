import type { IDbNotification } from "@/api/notifications";
import Button from "@/components/ui/Button";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { billingNoticeText, noticeKindOf } from "./billingNotice";

interface Props {
  n: IDbNotification;
  /** "Details": mark it read and open the invoice. */
  onOpen: () => void;
  onDelete: () => void;
}

const MANDATORY = new Set(["overdue_d2", "restricted_d5", "suspended_d7"]);

/**
 * One Cyber Place Platform payment notice in the feed (2026-11-09). The notice
 * itself is in ARMENIAN whatever the panel's language (owner rule); the
 * controls around it (Details, delete) follow the panel's language like every
 * other control.
 */
const PlatformBillingNoticeCard = ({ n, onOpen, onDelete }: Props) => {
  const { t } = useLang();
  const { title, body } = billingNoticeText(n);
  const kind = noticeKindOf(n);
  const unread = n.read_at === null;
  const tone = kind && MANDATORY.has(kind) ? "danger" : kind === "restored" || kind === "payment_recorded" ? "ok" : "warn";

  return (
    <article
      className={`card billing-notice billing-notice--${tone}${unread ? " is-unread" : ""}`}
      data-notice-kind={kind ?? "unknown"}
    >
      <div className="billing-notice__text">
        <h4 className="billing-notice__title">
          {unread && <span className="billing-notice__dot" aria-label={t("notifications.unreadDot")} />}
          {title}
        </h4>
        <p className="billing-notice__body">{body}</p>
        <span className="muted billing-notice__date">{formatDateTime(n.created_at)}</span>
      </div>
      <div className="billing-notice__actions">
        <Button type="button" variant="secondary" onClick={onOpen}>{t("platformBilling.details")}</Button>
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
