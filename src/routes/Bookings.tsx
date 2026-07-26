import { useAuth } from "@/auth/AuthContext";
import Pagination from "@/components/ui/Pagination";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { bookingRepository } from "@/repositories/BookingRepository";
import { useState } from "react";
import { Link } from "react-router-dom";

const Bookings = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const [page, setPage] = useState(1);

  const { data, loading, error } = useAsync(
    () =>
      bookingRepository.listPaged(page, {
        branch_id: user?.dashboard?.branch_id || undefined,
        company_id: user?.dashboard?.company_id,
      }),
    [page],
  );
  const bookings = data?.data ?? [];
  const lastPage = data?.meta?.last_page ?? 1;
  return (
    <ScreenWithBg bg="./bg/booking.jpg" title={t("bookings.title")}>
      {error && <div className="error">{error.message}</div>}
      {loading ? (
        <ListSkeleton />
      ) : !error ? (
        <div className="list">
          {bookings.map((b) => {
            const start = formatDateTime(b.start);
            return (
              <Link key={b.id} to={`/bookings/${b.id}`} className="list-item">
                <div>
                  <div className="name">
                    №{b.raw.code ?? b.id} · {b.raw.company?.name ?? "—"}
                  </div>
                  <div className="meta">
                    {start} · {b.raw.duration_minutes} {t("time.minShort")} ·{" "}
                    {b.raw.game?.name ?? ""}{" "}
                    {b.raw.game?.platform ? `(${b.raw.game.platform})` : ""}
                  </div>
                </div>
                <span className={`pill ${b.status}`}>{b.status}</span>
              </Link>
            );
          })}
          {!bookings.length && <div className="muted">{t("common.empty.bookings")}</div>}
        </div>
      ) : null}
      {!error && <Pagination page={page} lastPage={lastPage} onChange={setPage} disabled={loading} />}
    </ScreenWithBg>
  );
};

export default Bookings;
