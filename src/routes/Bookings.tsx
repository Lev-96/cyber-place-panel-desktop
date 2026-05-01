import { useAuth } from "@/auth/AuthContext";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { bookingRepository } from "@/repositories/BookingRepository";
import { Link } from "react-router-dom";

const Bookings = () => {
  const { user } = useAuth();
  const { t } = useLang();

  const { data, loading, error } = useAsync(
    () =>
      bookingRepository.listAll({
        branch_id: user?.dashboard?.branch_id || undefined,
        company_id: user?.dashboard?.company_id,
      }),
    [],
  );
  return (
    <ScreenWithBg bg="./bg/booking.jpg" title={t("bookings.title")}>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((b) => {
            const start = formatDateTime(b.start);
            return (
              <Link key={b.id} to={`/bookings/${b.id}`} className="list-item">
                <div>
                  <div className="name">
                    #{b.raw.code ?? b.id} · {b.raw.company?.name ?? "—"}
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
          {!data?.length && <div className="muted">{t("common.empty.bookings")}</div>}
        </div>
      )}
    </ScreenWithBg>
  );
};

export default Bookings;
