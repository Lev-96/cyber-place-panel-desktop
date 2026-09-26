import { useId, useState } from "react";
import { ISessionEvent } from "@/api/sessions";
import { formatDate, formatDateTime, formatTime } from "@/i18n/dates";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { eventPresentation, foldedIndexes, seatSteps } from "./sessionHistoryModel";

interface Props {
  /** The session's events, in any order; null while they are being fetched. */
  events: ISessionEvent[] | null;
  /** The session's start — an event on another day carries its date. */
  startedAt: string;
}

/**
 * One session's activity, as a horizontal timeline inside its card
 * (2026-09-26). Replaces the «Показать путь» toggle and the branch-wide
 * «Что происходило» list: every event of the session is here, once.
 *
 * Steps run left to right along ONE line. When they do not fit, that line —
 * and only it — scrolls sideways inside its own viewport: the card and the
 * page keep their width. The viewport is a keyboard-focusable region (← → once
 * focused); the vertical wheel stays the page's and Shift+wheel or a trackpad
 * scrolls the line, all native — no wheel handler. Each step reads top-down —
 * time, a marker coloured by the kind of event, what happened, what it put on
 * the bill, who, what changed. A session that changed seats carries a seat
 * chip on the step where each stretch began.
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

  if (events.length === 0) {
    return <span className="muted hs-note">{t("history.actionsEmpty")}</span>;
  }

  const rows = seatSteps(events);
  const { shown, hidden } = foldedIndexes(rows.length);
  const startDay = formatDate(startedAt);
  const firstHidden = rows.findIndex((_, i) => !shown.has(i));

  return (
    <div className="hs-activity">
      <div className="hs-scroll" role="region" aria-label={t("history.activityLabel")} tabIndex={0}>
      <ol className="hs-timeline" id={listId}>
        {rows.map(({ event: e, seat, chip }, i) => {
          const visible = expanded || shown.has(i);
          if (!visible) {
            // One quiet break on the line where the fold is.
            return i === firstHidden ? (
              <li key="gap" className="hs-gap" aria-hidden="true">
                <span className="hs-event__top" />
                <span className="hs-event__rail"><span className="hs-gap__dots">⋯</span></span>
              </li>
            ) : null;
          }
          const p = eventPresentation(e, t, money);
          const at = new Date(e.created_at);
          const revealed = expanded && !shown.has(i);
          return (
            <li key={e.id} className={`hs-event hs-tone-${p.tone}${revealed ? " hs-revealed" : ""}`}>
              <div className="hs-event__top">
                {/* Where this stretch was played, on the step that opened it. */}
                {chip && <span className="hs-seat__chip">{seat ?? t("history.seatUnknown")}</span>}
                <time className="hs-event__time" dateTime={e.created_at}>
                  {formatDate(at) === startDay ? formatTime(at) : formatDateTime(at)}
                </time>
              </div>
              <div className="hs-event__rail">
                <span className="hs-event__marker" aria-hidden="true">{p.icon}</span>
              </div>
              <div className="hs-event__body">
                <span className="hs-event__title">{p.title}</span>
                {e.amount !== null && <span className="hs-event__amount">{money(e.amount)}</span>}
                {/* The account may since have been deleted; the fact still
                    happened, so a nameless event is shown rather than hidden. */}
                {p.actor !== null && <span className="hs-event__actor">{p.actor}</span>}
                {p.details.map((d, k) => <span key={k} className="hs-event__detail">{d}</span>)}
              </div>
            </li>
          );
        })}
      </ol>
      </div>
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
