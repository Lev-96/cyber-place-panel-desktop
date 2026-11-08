import type { IStartOptionBooking } from "@/api/sessions";
import ChoiceCards, { type Choice } from "@/components/ui/ChoiceCards";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { formatArmenianPhone } from "@/utils/armenianPhone";

/** Who is sitting down: a reservation's player (its id), or somebody else. */
export type StartChoice = number | "walkin";

const hm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

interface Props {
  bookings: readonly IStartOptionBooking[];
  value: StartChoice | null;
  onChange: (choice: StartChoice) => void;
  /** "до 15:50" for the walk-in row; null when nothing caps it. */
  walkInUntil: string | null;
  disabled?: boolean;
}

/**
 * «Кто садится?» (2026-11-07, owner): on a seat with reservations the start
 * asks, every time, whether this is a reservation's player — that start
 * fulfils it — or somebody else, who may play only until the reservation.
 * Nothing is picked for the cashier: a wrong guess finished a stranger's
 * reservation. Shown only when the seat has reservations to fulfil.
 */
const StartBookingChoice = ({ bookings, value, onChange, walkInUntil, disabled = false }: Props) => {
  const { t } = useLang();
  const choices: Choice<StartChoice>[] = [
    ...bookings.map((b) => ({
      key: b.id as StartChoice,
      title: fmt(t("start.choice.booking"), b.who ?? t("reserve.noName")),
      detail: [`${hm(b.starts_at)}–${hm(b.ends_at)}`, b.contact_phone ? formatArmenianPhone(b.contact_phone) : null]
        .filter(Boolean).join(" · "),
      badge: t(b.source === "guest" ? "start.choice.fromApp" : "start.choice.reserved"),
      tone: "booked" as const,
    })),
    {
      key: "walkin",
      title: t("start.choice.walkIn"),
      detail: walkInUntil !== null ? fmt(t("start.choice.walkInUntil"), walkInUntil) : t("start.choice.walkInFree"),
    },
  ];
  return (
    <section className="col start-choice" data-testid="start-booking-choice">
      <span className="start-choice__title">{t("start.choice.title")}</span>
      <ChoiceCards
        label={t("start.choice.title")}
        name="start-who"
        choices={choices}
        value={value}
        onChange={onChange}
        disabled={disabled}
        testId="start-who"
      />
    </section>
  );
};

export default StartBookingChoice;
