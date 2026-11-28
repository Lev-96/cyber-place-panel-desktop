import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { bonusRepository } from "@/repositories/BonusRepository";
import { notify } from "@/ui/notify";
import type { ITimeBonusWin } from "@/types/bonus";
import { useCallback, useEffect, useRef, useState } from "react";
import { numberNameLine } from "@/components/sessions/seatLine";

/** How often waiting wins are read while the panel is open. */
export const TIME_BONUS_POLL_MS = 15_000;

const STAFF = new Set(["company_owner", "manager"]);

/**
 * A player's answers this person has acknowledged (QA 2026-11-25): kept on
 * THEIR panel, so an owner pressing «Понятно» at home never hides it from the
 * cashier. The server shows each answer for two hours.
 */
export const seenKey = (userId: number) => `u${userId}:cp.timeBonus.seen`;
const readSeen = (userId: number): number[] => {
  try {
    const v = JSON.parse(localStorage.getItem(seenKey(userId)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch { return []; }
};
const rememberSeen = (userId: number, id: number) => {
  try { localStorage.setItem(seenKey(userId), JSON.stringify([...readSeen(userId).filter((x) => x !== id), id].slice(-50))); } catch { /* storage off: asked again */ }
};

/**
 * «Бонус времени» (2026-11-25, owner): a running seat with a limit won free
 * minutes. One large, plain congratulation per win — the seat, the player
 * when a Club Card is on it, the minutes — and two answers: «Начислить»
 * (the minutes go onto the seat at no charge) or «Отказаться» (the player
 * does not want them). The server decides everything; nothing is computed
 * here. Owners and managers only, every branch they work in.
 *
 * With a Club Card on the seat the player is asked in the app too
 * (2026-11-25): the window says so, and either may answer. When the PLAYER
 * answered, the desk is told once («Игрок подтвердил: +30 мин добавлено») and
 * presses «Понятно».
 */
const TimeBonusNotifier = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const [wins, setWins] = useState<ITimeBonusWin[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reads = useRef(0);
  const asks = user?.role !== undefined && STAFF.has(user.role);

  const load = useCallback(() => {
    if (!asks) return;
    const mine = ++reads.current;
    bonusRepository.pendingTimeBonus()
      .then((list) => { if (mine === reads.current) setWins(Array.isArray(list) ? list : []); })
      .catch(() => { /* offline or an older server: asked again on the next read */ });
  }, [asks]);

  useEffect(() => {
    if (!asks) return undefined;
    load();
    const timer = window.setInterval(load, TIME_BONUS_POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [asks, load]);

  const userId = user?.id ?? 0;
  const current = wins.find((w) => !(w.answered_by === "player" && (w.status ?? "pending") !== "pending" && readSeen(userId).includes(w.id))) ?? null;
  useEffect(() => { setErr(null); }, [current?.id]);
  if (!asks || !current) return null;

  const seat = current.place ? numberNameLine(current.place.number ?? current.place.id, current.place.name) : `#${current.session_id}`;

  const playerAnswered = current.answered_by === "player" && (current.status ?? "pending") !== "pending";
  const seen = () => {
    rememberSeen(userId, current.id);
    setWins((list) => list.filter((w) => w.id !== current.id));
  };

  if (playerAnswered) {
    const key = current.status === "granted" ? "timeBonus.playerTook" : current.status === "declined" ? "timeBonus.playerDeclined" : "timeBonus.playerTooLate";
    return (
      <Modal open>
        <div className="card due-confirm time-bonus" role="alertdialog" aria-modal="true" data-testid="time-bonus-player-answer">
          <div className="time-bonus__burst" aria-hidden="true">{current.status === "granted" ? "✅" : "ℹ️"}</div>
          <h2 className="due-confirm__title">{fmt(t(key), String(current.minutes))}</h2>
          <p className="time-bonus__seat">{seat}</p>
          {current.player && <p className="time-bonus__player">{current.player}</p>}
          <div className="due-confirm__answers">
            <Button onClick={seen} data-testid="time-bonus-seen">{t("timeBonus.ok")}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const answer = async (grant: boolean) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (grant) {
        await bonusRepository.grantTimeBonus(current.id);
        notify.message("success", fmt(t("timeBonus.granted"), String(current.minutes), seat));
      } else {
        await bonusRepository.declineTimeBonus(current.id);
      }
      setWins((list) => list.filter((w) => w.id !== current.id));
      load();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : t("session.failUnknown"));
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    // No onClose: no ×, no Escape — the win is answered by one of its two buttons.
    <Modal open>
      <div className="card due-confirm time-bonus" role="alertdialog" aria-modal="true" data-testid="time-bonus">
        <div className="time-bonus__burst" aria-hidden="true">🎉</div>
        <h2 className="due-confirm__title">{t("timeBonus.title")}</h2>
        <p className="time-bonus__seat" data-testid="time-bonus-seat">{seat}</p>
        {current.player && <p className="time-bonus__player" data-testid="time-bonus-player">{current.player}</p>}
        <p className="time-bonus__prize" data-testid="time-bonus-prize">{fmt(t("timeBonus.prize"), String(current.minutes))}</p>
        <p className="muted time-bonus__note">{t("timeBonus.note")}</p>
        {current.asked_player && <p className="muted time-bonus__note" data-testid="time-bonus-asked-player">{t("timeBonus.askedPlayer")}</p>}
        {err && <div className="error" role="alert" data-testid="time-bonus-error">{err}</div>}
        <div className="due-confirm__answers">
          <Button onClick={() => void answer(true)} disabled={busy} data-testid="time-bonus-grant">{fmt(t("timeBonus.grant"), String(current.minutes))}</Button>
          <Button variant="secondary" onClick={() => void answer(false)} disabled={busy} data-testid="time-bonus-decline">{t("timeBonus.decline")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default TimeBonusNotifier;
