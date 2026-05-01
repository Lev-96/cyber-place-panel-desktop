import { apiGetBooking } from "@/api/bookings";
import BranchRatingModal from "@/components/bookings/BranchRatingModal";
import CancelReasonModal from "@/components/bookings/CancelReasonModal";
import RescheduleModal from "@/components/bookings/RescheduleModal";
import Button from "@/components/ui/Button";
import QrCode from "@/components/ui/QrCode";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { useState } from "react";
import { useParams } from "react-router-dom";

const BookingDetails = () => {
  const { t } = useLang();
  const { bookingId } = useParams();
  const id = Number(bookingId);
  const { data, loading, error, reload } = useAsync(
    () => apiGetBooking(id).then((r) => r.booking),
    [id],
  );
  const [reschedule, setReschedule] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [rate, setRate] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;
  if (!data) return null;

  const startTime = (data.start_time ?? "").slice(0, 5);
  const start = `${formatDate(data.booking_date)} ${startTime}`;
  const canModify = data.status === "pending" || data.status === "confirmed";

  const statusLabel = t(`bookingDetails.status.${data.status}`) || data.status;
  return (
    <ScreenWithBg
      bg="./bg/booking.jpg"
      title={`${t("bookingDetails.title")} #${data.code ?? data.id}`}
    >
      <div
        className="row"
        style={{ gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}
      >
        <div className="card col" style={{ gap: 8, flex: "2 1 360px" }}>
          <Row
            k={t("bookingDetails.status")}
            v={<span className={`pill ${data.status}`}>{statusLabel}</span>}
          />
          <Row k={t("bookingDetails.code")} v={String(data.code)} />
          <Row k={t("bookingDetails.company")} v={data.company?.name ?? "—"} />
          <Row k={t("bookingDetails.branch")} v={data.branch?.address ?? "—"} />
          <Row
            k={t("bookingDetails.game")}
            v={`${data.game?.name ?? "—"} ${data.game?.platform ? `(${data.game.platform})` : ""}`}
          />
          <Row k={t("bookingDetails.start")} v={start} />
          <Row
            k={t("bookingDetails.duration")}
            v={`${data.duration_minutes} ${t("bookingDetails.minShort")}${data.rescheduled_minutes ? ` (+${data.rescheduled_minutes})` : ""}`}
          />
          <Row k={t("bookingDetails.places")} v={String(data.place_booking_count || "0")} />
          <Row k={t("bookingDetails.endTime")} v={data.end_time} />
        </div>

        <div
          className="col"
          style={{ gap: 12, flex: "1 1 240px", alignItems: "center" }}
        >
          <span className="muted" style={{ fontSize: 12 }}>
            {t("bookingDetails.showCode")}
          </span>
          <QrCode value={String(data.code)} size={200} />
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {canModify && (
          <Button variant="secondary" onClick={() => setReschedule(true)}>
            {t("bookingDetails.reschedule")}
          </Button>
        )}
        {canModify && (
          <Button
            variant="secondary"
            onClick={() => setCancel(true)}
            style={{ color: "#ef4444", borderColor: "#4a1a1a" }}
          >
            {t("bookingDetails.cancel")}
          </Button>
        )}
        {data.branch && (
          <Button variant="secondary" onClick={() => setRate(true)}>
            {t("bookingDetails.rate")}
          </Button>
        )}
      </div>

      {reschedule && (
        <RescheduleModal
          bookingId={data.id}
          currentMinutes={data.rescheduled_minutes ?? 0}
          onClose={() => setReschedule(false)}
          onDone={() => {
            setReschedule(false);
            void reload();
          }}
        />
      )}
      {cancel && (
        <CancelReasonModal
          bookingId={data.id}
          onClose={() => setCancel(false)}
          onDone={() => {
            setCancel(false);
            void reload();
          }}
        />
      )}
      {rate && data.branch && (
        <BranchRatingModal
          branchId={data.branch.id}
          onClose={() => setRate(false)}
          onDone={() => setRate(false)}
        />
      )}
    </ScreenWithBg>
  );
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="kv-row">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);

export default BookingDetails;
