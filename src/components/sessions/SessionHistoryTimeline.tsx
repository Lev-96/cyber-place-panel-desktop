import { useId, useState } from "react";
import { ISessionEvent } from "@/api/sessions";
import { formatDate, formatDateTime, formatTime } from "@/i18n/dates";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { eventPresentation, foldedIndexes, segmentsOf } from "./sessionHistoryModel";

interface Props {
  /** The session's events, in any order; null while they are being fetched. */
  events: ISessionEvent[] | null;
  /** The session's start — an event on another day carries its date. */
  startedAt: string;
}

/**
 * One session's activity, as a vertical timeline inside its card
 * (2026-09-26). Replaces the «Показать путь» toggle and the branch-wide
 * «Что происходило» list: every event of the session is here, once.
 *
 * Each event reads top-down — time, what happened, who, what changed, what it
 * put on the bill — with a marker coloured by the kind of event. A session that
 * changed seats gets a seat chip on the rail where each stretch began.
 *
 * A long history folds its middle: the start and the finish stay in view, and
 * one real button — mounted in both states, so the focus never drops — shows
 * the rest or folds it again. Nothing is fetched by it.
 */
const SessionHistoryTimeline = ({ events, startedAt }: Props) => {
  const { t, money } = useLang();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);

  if (events === null) {
    return <span className="muted hs-note">{t("history.timelineLoading")}</span>;
  }

  const segments = segmentsOf(events);
  if (segments.length === 0) {
    return <span className="muted hs-note">{t("history.actionsEmpty")}</span>;
  }

  // One list, oldest first; a seat chip opens each stretch when there was a move.
  const moved = segments.length > 1;
  const rows = segments.flatMap((seg) =>
    seg.events.map((e, k) => ({ e, seat: moved && k === 0 ? seg.seat ?? t("history.seatUnknown") : null })));

  const { shown, hidden } = foldedIndexes(rows.length);
  const startDay = formatDate(startedAt);
  const firstHidden = rows.findIndex((_, i) => !shown.has(i));

  return (
    <div className="hs-activity">
      <ol className="hs-timeline" id={listId}>
        {rows.map(({ e, seat }, i) => {
          const visible = expanded || shown.has(i);
          if (!visible) {
            // One quiet break on the rail where the fold is.
            return i === firstHidden ? (
              <li key="gap" className="hs-gap" aria-hidden="true">
                <span className="hs-gap__dots">⋮</span>
              </li>
            ) : null;
          }
          const p = eventPresentation(e, t, money);
          const at = new Date(e.created_at);
          const revealed = expanded && !shown.has(i);
          return [
            seat !== null && (
              <li key={`seat-${e.id}`} className={`hs-seat${revealed ? " hs-revealed" : ""}`}>
                <span className="hs-seat__chip">{seat}</span>
              </li>
            ),
            <li key={e.id} className={`hs-event hs-tone-${p.tone}${revealed ? " hs-revealed" : ""}`}>
              <time className="hs-event__time" dateTime={e.created_at}>
                {formatDate(at) === startDay ? formatTime(at) : formatDateTime(at)}
              </time>
              <span className="hs-event__marker" aria-hidden="true">{p.icon}</span>
              <div className="hs-event__body">
                <div className="hs-event__head">
                  <span className="hs-event__title">{p.title}</span>
                  {e.amount !== null && <span className="hs-event__amount">{money(e.amount)}</span>}
                </div>
                {/* The account may since have been deleted; the fact still
                    happened, so a nameless event is shown rather than hidden. */}
                {p.actor !== null && <span className="hs-event__actor">{p.actor}</span>}
                {p.details.map((d, k) => <span key={k} className="hs-event__detail">{d}</span>)}
              </div>
            </li>,
          ];
        })}
      </ol>
      {hidden > 0 && (
        <button
          type="button"
          className="hs-more"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t("history.collapse") : fmt(t("history.showMore"), hidden)}
        </button>
      )}
    </div>
  );
};

export default SessionHistoryTimeline;
