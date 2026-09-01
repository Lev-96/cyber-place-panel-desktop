import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiDecideWakeEvent, apiExpireWakeEvent, apiPendingWakeEvents } from "@/api/ps5";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useLang } from "@/i18n/LanguageContext";
import { usePs5UnexpectedWake, type Ps5UnexpectedWakeEvent } from "@/realtime/usePs5Realtime";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "A console in your venue is on. Was that you?"
 *
 * Shown to the owner and to nobody else — the backend broadcasts it on the
 * owner's own private channel, and this only mounts for a role that holds
 * `branch.places`. A manager starts and stops sessions all day; whether a
 * console may be awake outside one is a question about the owner's property,
 * and the honest form of it is asking the person who might have switched it on.
 *
 * ## Why the countdown is here and the sleeping is not
 * The panel standing in the room is the one that can reach the console, and it
 * runs its own ten seconds. This dialog counts the same ten down so the owner
 * can see how long they have, and reports the outcome so the history knows
 * whether nobody answered or somebody said no — but it never assumes it is the
 * machine that will act.
 *
 * A wake that arrives while another is on screen queues behind it: two consoles
 * switching on in the same minute is two questions, and stacking them into one
 * dialog would answer the second with the first one's click.
 */
/** The countdown a question carries when it was fetched rather than broadcast. */
const GRACE_SECONDS = 10;

const UnexpectedWakeDialog = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const isOwner = can(user?.role, "branch.places");

  const [queue, setQueue] = useState<Ps5UnexpectedWakeEvent[]>([]);
  /**
   * When this question runs out, as a moment rather than a counter.
   *
   * A counter starting at zero and being raised by an effect is a frame in
   * which "no time left" is true of a question that has only just arrived —
   * and this dialog acts on that by reporting it expired. A deadline tied to
   * the event's own uuid cannot be mistaken for a different question's, and is
   * never momentarily zero.
   */
  const [deadline, setDeadline] = useState<{ uuid: string; at: number } | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const current = queue[0] ?? null;
  /** Guards against answering the same question twice on a double click. */
  const answeredRef = useRef<Set<string>>(new Set());

  const enqueue = useCallback((event: Ps5UnexpectedWakeEvent) => {
    setQueue((q) => (q.some((e) => e.event_uuid === event.event_uuid) ? q : [...q, event]));
  }, []);

  usePs5UnexpectedWake(isOwner ? (user?.id ?? null) : null, enqueue);

  /**
   * Ask for questions nobody answered.
   *
   * A broadcast reaches whoever was listening at that second and nobody else —
   * so a console switched on while the owner was on another screen, or before
   * this panel was open, raised a question that then sat unanswered forever.
   * That is what happened: three of them, hours old, still waiting.
   *
   * Asked on mount and then slowly. The socket stays the fast path; this is the
   * net underneath it, and it must not become a poll that talks over it.
   */
  useEffect(() => {
    if (!isOwner) return;

    let alive = true;
    const pull = async () => {
      try {
        const events = await apiPendingWakeEvents();
        if (!alive) return;

        for (const event of events.data) {
          // Anything already answered on this machine stays answered.
          if (answeredRef.current.has(event.event_uuid)) continue;

          enqueue({
            id: event.id,
            event_uuid: event.event_uuid,
            device_id: event.device_id,
            branch_id: event.branch_id,
            branch_name: event.branch_name,
            multi_branch: event.multi_branch,
            place_label: event.place_label ?? "",
            grace_seconds: GRACE_SECONDS,
          });
        }
      } catch {
        // Offline, or an older backend. The socket path is unaffected.
      }
    };

    void pull();
    const timer = setInterval(() => void pull(), 60_000);

    return () => { alive = false; clearInterval(timer); };
  }, [isOwner, enqueue]);

  // Each question gets its own deadline; none inherits the remainder of
  // another's.
  useEffect(() => {
    if (!current) {
      setDeadline(null);
      return;
    }

    setDeadline({ uuid: current.event_uuid, at: Date.now() + current.grace_seconds * 1_000 });
    setNowTick(Date.now());

    const tick = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(tick);
  }, [current]);

  /** Seconds left, or null while the deadline belongs to another question. */
  const remaining = current && deadline?.uuid === current.event_uuid
    ? Math.max(0, Math.ceil((deadline.at - nowTick) / 1_000))
    : null;

  const done = useCallback((uuid: string) => {
    setQueue((q) => q.filter((e) => e.event_uuid !== uuid));
  }, []);

  const answer = useCallback(async (approved: boolean) => {
    if (!current || answeredRef.current.has(current.event_uuid)) return;

    answeredRef.current.add(current.event_uuid);
    setBusy(true);
    try {
      await apiDecideWakeEvent(current.id, approved);
    } catch {
      // The answer did not reach the server. The console is still handled by
      // the panel in the room, whose ten seconds run whatever this tab does —
      // so the question is dismissed rather than left hanging with a stale
      // countdown.
      answeredRef.current.delete(current.event_uuid);
    } finally {
      setBusy(false);
      done(current.event_uuid);
    }
  }, [current, done]);

  // Nobody answered. Recorded as expired — a different fact from a refusal, and
  // worth telling apart when somebody reads the history later.
  useEffect(() => {
    // `remaining === null` means this question has no deadline yet — the very
    // frame it arrived in. Treating that as "time is up" would expire every
    // wake the instant it was raised.
    if (!current || remaining === null || remaining > 0 || answeredRef.current.has(current.event_uuid)) return;

    answeredRef.current.add(current.event_uuid);
    void apiExpireWakeEvent(current.id).catch(() => null).finally(() => done(current.event_uuid));
  }, [current, remaining, done]);

  if (!isOwner || !current) return null;

  return (
    <Modal open onClose={() => void answer(false)}>
      <div className="card col ps5-wake-dialog">
        <h2 className="ps5-wake-dialog__title">{t("ps5.wake.dialogTitle")}</h2>
        {/* Which venue, and only when the owner has more than one. With a
            single branch the line is a fact they already know on every question
            they will ever be asked; with three it is the difference between an
            answerable question and a guess about which floor it came from. The
            server decides which of the two this owner is. */}
        {current.multi_branch && current.branch_name && (
          <div className="ps5-wake-dialog__branch" title={current.branch_name}>
            {t("ps5.wake.branch")}: {current.branch_name}
          </div>
        )}
        <div className="ps5-wake-dialog__place" title={current.place_label}>{current.place_label}</div>
        <p className="muted" style={{ margin: 0 }}>{t("ps5.wake.dialogBody")}</p>

        <div className="ps5-wake-dialog__countdown">
          {t("ps5.wake.dialogCountdown").replace("{s}", String(remaining ?? current.grace_seconds))}
        </div>

        <div className="row-between" style={{ gap: 10 }}>
          <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>
            {t("ps5.wake.no")}
          </Button>
          <Button disabled={busy} onClick={() => void answer(true)}>
            {t("ps5.wake.yes")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UnexpectedWakeDialog;
