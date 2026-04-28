import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { bookingRepository } from "@/repositories/BookingRepository";
import { Link } from "react-router-dom";

const Bookings = () => {
  const { data, loading, error } = useAsync(() => bookingRepository.listAll({}), []);

  return (
    <ScreenWithBg bg="./bg/booking.jpg" title="Bookings">
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((b) => {
            const start = b.start.toLocaleString();
            return (
              <Link key={b.id} to={`/bookings/${b.id}`} className="list-item">
                <div>
                  <div className="name">#{b.raw.code ?? b.id} · {b.raw.company?.name ?? "—"}</div>
                  <div className="meta">{start} · {b.raw.duration_minutes} min · {b.raw.game?.name ?? ""} {b.raw.game?.platform ? `(${b.raw.game.platform})` : ""}</div>
                </div>
                <span className={`pill ${b.status}`}>{b.status}</span>
              </Link>
            );
          })}
          {!data?.length && <div className="muted">No bookings.</div>}
        </div>
      )}
    </ScreenWithBg>
  );
};

export default Bookings;
