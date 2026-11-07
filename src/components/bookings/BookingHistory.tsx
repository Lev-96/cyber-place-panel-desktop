import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { bookingRepository } from "@/repositories/BookingRepository";
import { bookingEventActionKey, bookingEventActor, bookingEventDetail, bookingEventSubject } from "./bookingEventText";

interface Props {
  branchId: number;
  fromIso: string;
  toIso: string;
  /** Bumped by the page's Refresh. */
  refreshKey: number;
}

/**
 * Every step of the branch's bookings in the period (2026-11-07, owner: "all
 * actions in the history, bookings too"): made, moved, cancelled (and why),
 * started by a player, finished, its start time come — who did it and when.
 * The server scopes it (owner: own branches, manager: own branch); contacts
 * are never part of it. Its own loading, so the sessions below never wait.
 */
const BookingHistory = ({ branchId, fromIso, toIso, refreshKey }: Props) => {
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(
    () => bookingRepository.listEvents({ branch_id: branchId, from: fromIso, to: toIso, limit: 1000 }),
    [branchId, fromIso, toIso, refreshKey],
  );

  return (
    <section className="gradient-card booking-history" data-testid="booking-history">
      <div className="gradient-card-inner col" style={{ gap: 10 }}>
        <div className="row-between" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <strong>{t("bookingHistory.title")}</strong>
          {data && data.length > 0 && <span className="muted">{data.length}</span>}
        </div>
        {loading && !data ? <ListSkeleton rows={2} /> : error ? (
          <ErrorState size="compact" error={error} onRetry={() => void reload()} titleKey="bookingHistory.error" descriptionKey={null} />
        ) : !data || data.length === 0 ? (
          <span className="muted" style={{ fontSize: 13 }}>{t("bookingHistory.empty")}</span>
        ) : (
          <ul className="booking-history__list">
            {data.map((e) => {
              const detail = bookingEventDetail(e, t);
              return (
                <li key={e.id} className="booking-history__row" data-action={e.action} data-testid="booking-history-row">
                  <span className="booking-history__when">{formatDateTime(new Date(e.created_at))}</span>
                  <span className={`booking-history__action is-${e.action}`}>{t(bookingEventActionKey(e))}</span>
                  <span className="booking-history__subject">{bookingEventSubject(e, t)}</span>
                  {detail && <span className="booking-history__detail muted">{detail}</span>}
                  <span className="booking-history__who muted">{bookingEventActor(e, t)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default BookingHistory;
