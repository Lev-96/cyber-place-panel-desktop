import LineIcon from "@/components/ui/LineIcon";
import Switch from "@/components/ui/Switch";
import TimeInput from "@/components/ui/TimeInput";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { bandOf, DayRow, dayLabel, hintOf, runsPastMidnight, spanOf } from "./openDaysModel";

const DAY_MINUTES = 24 * 60;

interface Props {
  row: DayRow;
  /** The row's times are marked: incomplete on save, or refused by the server. */
  invalidStart: boolean;
  invalidEnd: boolean;
  disabled: boolean;
  onChange: (next: DayRow) => void;
  onApplyToAll: () => void;
}

/**
 * One weekday of the working-hours form: open/closed switch, open and close
 * times, what a close after midnight means, and the day on a 24-hour track.
 *
 * DOM order is the focus order (switch → open → close → apply to all); the
 * hint and the track are not focusable, so CSS may move them around the
 * button (beside the times on a desktop, under them on a phone).
 */
const OpenDayRow = ({ row, invalidStart, invalidEnd, disabled, onChange, onApplyToAll }: Props) => {
  const { t } = useLang();
  const day = dayLabel(row.day_of_week, t);
  const kind = spanOf(row);
  const hint = row.open ? hintOf(row, t) : null;
  const band = row.open ? bandOf(row) : null;
  const field = (which: "branch.openTime" | "branch.closeTime") => fmt(t("openDays.timeField"), day, t(which));

  return (
    <li className="open-day" data-open={row.open ? "1" : undefined} data-testid={`open-day-${row.day_of_week}`}>
      <div className="open-day__day">
        <Switch
          size="md"
          checked={row.open}
          onChange={(open) => onChange({ ...row, open })}
          label={day}
          disabled={disabled}
        />
      </div>

      {row.open ? (
        <div className="open-day__hours">
          <span className="open-day__time">
            <TimeInput
              ariaLabel={field("branch.openTime")}
              value={row.start_time}
              onChange={(start_time) => onChange({ ...row, start_time })}
              invalid={invalidStart}
              disabled={disabled}
            />
          </span>
          <span className="open-day__dash" aria-hidden>–</span>
          <span className="open-day__time">
            <TimeInput
              ariaLabel={field("branch.closeTime")}
              value={row.end_time}
              onChange={(end_time) => onChange({ ...row, end_time })}
              invalid={invalidEnd}
              disabled={disabled}
            />
          </span>
        </div>
      ) : (
        <span className="open-day__off">{t("branch.dayOff")}</span>
      )}

      {row.open && (
        <button
          type="button"
          className="open-day__copy"
          onClick={onApplyToAll}
          disabled={disabled}
          aria-label={fmt(t("openDays.copyToAll"), day)}
          title={fmt(t("openDays.copyToAll"), day)}
        >
          <LineIcon size={18}>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </LineIcon>
        </button>
      )}

      {hint && (
        <span className="open-day__hint" data-testid="open-day-hint" data-span={kind}>
          {runsPastMidnight(kind) && (
            <LineIcon size={14}>
              <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
            </LineIcon>
          )}
          {hint}
        </span>
      )}

      {/* The day on a 24-hour track, 00:00 at the left. The part of an
          overnight window after midnight belongs to tomorrow, so the band
          runs to the right edge and turns to the night end of the brand
          gradient there; the hint above says it in words. */}
      {row.open && (
        <span className="open-day__track" aria-hidden>
          {band && (
            <>
              <span className="open-day__gap" style={{ flexGrow: band.from }} />
              <span
                className={`open-day__band${runsPastMidnight(kind) ? " is-overnight" : ""}`}
                style={{ flexGrow: band.to - band.from }}
              />
              <span className="open-day__gap" style={{ flexGrow: DAY_MINUTES - band.to }} />
            </>
          )}
        </span>
      )}
    </li>
  );
};

export default OpenDayRow;
