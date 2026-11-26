import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import RankBadge from "@/components/bonus/RankBadge";
import RateVisitForm, { rateVisitBody, rateVisitReady, type RateVisitValue } from "@/components/bonus/RateVisitForm";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import { notify } from "@/ui/notify";
import { playFor } from "@/sound/soundEngine";
import type { IBonusAccount } from "@/types/bonus";
import { useCallback, useEffect, useRef, useState } from "react";

/** How often the players to rate are read while the panel is open. */
export const RATE_DUE_POLL_MS = 30_000;

const STAFF = new Set(["company_owner", "manager"]);
const EMPTY: RateVisitValue = { stars: 0, comment: "", gift: 0 };

/**
 * «Оцените визит игрока» (2026-11-27, owner): after a visit — a game or a
 * purchase that moved a Club Card — the club rates the player with stars (the
 * reason at 1 star) and may give bonuses as a gift. Every desk of the
 * branch shows the window; the first answer closes it everywhere (the
 * server's list). «Не сейчас» answers this visit without a rating. Owners
 * and managers only.
 */
const RatePlayerNotifier = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const [due, setDue] = useState<IBonusAccount[]>([]);
  const [value, setValue] = useState<RateVisitValue>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reads = useRef(0);
  const asks = user?.role !== undefined && STAFF.has(user.role);

  const load = useCallback(() => {
    if (!asks) return;
    const mine = ++reads.current;
    bonusRepository.rateDue()
      .then((list) => { if (mine === reads.current) setDue(Array.isArray(list) ? list : []); })
      .catch(() => { /* offline or an older server: asked again on the next read */ });
  }, [asks]);

  useEffect(() => {
    if (!asks) return undefined;
    load();
    const timer = window.setInterval(load, RATE_DUE_POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [asks, load]);

  const current = due[0] ?? null;
  useEffect(() => { setValue(EMPTY); setErr(null); }, [current?.id]);
  // A window that opens is heard (2026-11-27, owner): the «Гости» sound, as
  // the person set it, once per visit (a re-read of the same one is silent).
  const dueKey = current ? `rate-due:${current.id}:${current.due_at ?? ""}` : null;
  useEffect(() => {
    if (dueKey) { try { playFor("guests", dueKey); } catch { /* sound is a courtesy */ } }
  }, [dueKey]);
  if (!asks || !current) return null;

  const answer = async (skip: boolean) => {
    if (busy || (!skip && !rateVisitReady(value))) return;
    setBusy(true);
    setErr(null);
    try {
      await bonusRepository.rate(current.branch_id, current.id, skip
        ? { skip: true }
        : rateVisitBody(value));
      if (!skip) notify.message("success", t("rating.sent"));
      setDue((list) => list.filter((a) => a.id !== current.id));
      load();
    } catch (e) {
      // Answered at another desk meanwhile (409): the next read drops it.
      setErr(e instanceof Error && e.message ? e.message : t("session.failUnknown"));
      load();
    } finally {
      setBusy(false);
    }
  };

  const name = current.name?.trim() || t("bonus.noName");
  const rating = current.player_rating;

  return (
    // No ×, no Escape: the window is answered by «Отправить» or «Не сейчас».
    <Modal open>
      <form className="card due-confirm rate-player" role="alertdialog" aria-modal="true" aria-labelledby="rate-player-title"
        onSubmit={(e) => { e.preventDefault(); void answer(false); }} data-testid="rate-player">
        <div className="rate-player__head">
          <span className="rate-player__avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
          <div className="rate-player__who">
            <h2 className="due-confirm__title" id="rate-player-title">{t("rating.ratePlayer")}</h2>
            <div className="rate-player__name" data-testid="rate-player-name">
              {name} <RankBadge rank={current.rank} label={current.rank_name} />
            </div>
            <div className="muted rate-player__meta">
              {rating && rating.average !== null
                ? t("bonus.rating.player").replace("{0}", rating.average).replace("{1}", String(rating.count))
                : t("bonus.rating.playerNone")}
            </div>
          </div>
        </div>
        <RateVisitForm value={value} onChange={setValue} disabled={busy} testId="rate-player-form" />
        {err && <div className="error" role="alert" data-testid="rate-player-error">{err}</div>}
        <div className="due-confirm__answers">
          <Button type="submit" disabled={busy || !rateVisitReady(value)} data-testid="rate-player-send">{t("rating.send")}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void answer(true)} data-testid="rate-player-skip">{t("rating.notNow")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default RatePlayerNotifier;
