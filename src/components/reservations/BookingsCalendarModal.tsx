import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import BookingsCalendar, { type BookingsCalendarProps } from "./BookingsCalendar";

interface Props extends BookingsCalendarProps {
  onClose: () => void;
}

/**
 * The bookings calendar as a near-fullscreen dialog over the board
 * (2026-11-07). `data-tip-scope`: every `title` inside gets the panel's
 * tooltip, as on the board. Escape, the × and the backdrop close it
 * (`Modal`); the forms it opens stack above it and take Escape first.
 * `onStartBooking` (optional) puts «Старт» on due bookings; the board
 * closes the calendar and opens its Start dialog with that booking.
 */
const BookingsCalendarModal = ({ onClose, ...calendar }: Props) => {
  const { t } = useLang();
  return (
    <Modal open onClose={onClose} confirmOnDirty={false}>
      <section className="card cal-modal" data-tip-scope aria-label={t("calendar.title")} data-testid="bookings-calendar-modal">
        <BookingsCalendar {...calendar} />
      </section>
    </Modal>
  );
};

export default BookingsCalendarModal;
