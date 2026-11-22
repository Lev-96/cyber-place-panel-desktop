import type { IDueToConfirm } from "@/api/sessions";
import PaymentEditor from "@/components/payments/PaymentEditor";
import { PAYMENT_PROBLEM_KEY, checkPayment, emptyPaymentDraft, paymentBody, type PaymentDraft } from "@/components/payments/paymentSplit";
import { methodName } from "@/components/sales/salesSummaryModel";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { sessionRepository } from "@/repositories/SessionRepository";
import { playFor } from "@/sound/soundEngine";
import { notify } from "@/ui/notify";
import type { PaymentMethod } from "@/api/sessions";
import { useCallback, useEffect, useRef, useState } from "react";
import { centsWhenFractional } from "@/i18n/currency";
import { registerDueAsker, type DueAnswer } from "./dueConfirmGate";
import { numberNameLine } from "@/components/sessions/seatLine";

/** How often the list is read again while the panel is open. */
export const DUE_POLL_MS = 30_000;
/** «Позже»: that seat is not asked about again for this long. */
export const DUE_LATER_MS = 10 * 60_000;

const STAFF = new Set(["company_owner", "manager"]);

/** The way the seat was paid ahead, when it was one way — what «Да» starts on. */
export const paidAheadMethod = (d: IDueToConfirm): PaymentMethod => {
  const ways = Object.keys(d.prepaid_by_method ?? {}).filter((m) => Number(d.prepaid_by_method[m]) > 0);
  return ways.length === 1 && ["cash", "card", "other"].includes(ways[0]) ? (ways[0] as PaymentMethod) : "cash";
};

/**
 * «Подтверждение оплаты» (2026-11-20, owner): a seat paid ahead («Сейчас, до
 * игры») that ENDED BY ITSELF owing more — products put on it while it played,
 * time beyond what was paid. The server banked the due in cash (no answer =
 * cash) and lists it here until somebody says how it was really paid.
 *
 * One large, plain question per seat: what was added and what is owed, then
 * «Да, оплатили» → how it was paid, or «Нет — принять оплату» → take it now;
 * both send the way of paying to `POST /sessions/{id}/confirm-due`, which
 * moves the due to its card in «История продаж». «Позже» asks again in ten
 * minutes. Owners and managers only; nothing is computed here.
 *
 * Asked AT ONCE when the board sees a seat end by itself (`dueConfirmGate`),
 * and the board's final bill waits for the answer (2026-11-20, owner): first
 * «оплатили?», then the bill. The poll stays the safety net for a desk that
 * was not on the board when the seat ended.
 */
const DueConfirmNotifier = () => {
  const { user } = useAuth();
  const { t, money } = useLang();
  const [dues, setDues] = useState<IDueToConfirm[]>([]);
  const [step, setStep] = useState<"ask" | "paid" | "take">("ask");
  const [pay, setPay] = useState<PaymentDraft>(() => emptyPaymentDraft("cash"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const later = useRef(new Map<number, number>());
  const rang = useRef(new Set<number>());
  // Ended seats whose final bill waits for this window: resolved once the
  // seat is no longer being asked about (answered, «Позже», or gone).
  const waiting = useRef(new Map<number, Array<(answer: DueAnswer) => void>>());
  // What was answered for a seat, handed to its bill (2026-11-20).
  const answered = useRef(new Map<number, DueAnswer>());
  // Only the newest read is applied: a poll sent before a seat ended must
  // not land after the board's own read and drop that seat again.
  const reads = useRef(0);
  const asks = user?.role !== undefined && STAFF.has(user.role);

  const load = useCallback(() => {
    if (!asks) return;
    const mine = ++reads.current;
    sessionRepository.duesToConfirm()
      .then((list) => { if (mine === reads.current) setDues(Array.isArray(list) ? list : []); })
      .catch(() => { /* offline: asked again on the next read */ });
  }, [asks]);

  useEffect(() => {
    if (!asks) return undefined;
    const pending = waiting.current;
    const unregister = registerDueAsker((sessionId) => new Promise<DueAnswer>((resolve) => {
      ++reads.current;
      sessionRepository.duesToConfirm()
        .then((list) => {
          const fresh = Array.isArray(list) ? list : [];
          if (fresh.some((d) => d.session_id === sessionId)) {
            later.current.delete(sessionId);
            pending.set(sessionId, [...(pending.get(sessionId) ?? []), resolve]);
          } else {
            resolve(null);
          }
          // Always applied: read after the seat ended, it is never the stale one.
          setDues(fresh);
        })
        // Not readable now: the bill opens; the poll asks later.
        .catch(() => resolve(null));
    }));
    return () => {
      unregister();
      for (const fns of pending.values()) fns.forEach((f) => f(null));
      pending.clear();
    };
  }, [asks]);

  // A seat no longer asked about lets its bill open.
  useEffect(() => {
    const at = Date.now();
    for (const [id, fns] of [...waiting.current]) {
      const asked = dues.some((d) => d.session_id === id) && (later.current.get(id) ?? 0) <= at;
      if (!asked) {
        const answer = answered.current.get(id) ?? null;
        waiting.current.delete(id);
        answered.current.delete(id);
        fns.forEach((f) => f(answer));
      }
    }
  }, [dues]);

  useEffect(() => {
    if (!asks) return undefined;
    load();
    const timer = window.setInterval(load, DUE_POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [asks, load]);

  const now = Date.now();
  const current = dues.find((d) => (later.current.get(d.session_id) ?? 0) <= now) ?? null;
  const dueCents = current ? Math.round(Number(current.due) * 100) : 0;
  const check = checkPayment(dueCents, pay);

  useEffect(() => {
    if (!current) return;
    setStep("ask");
    setErr(null);
    if (!rang.current.has(current.session_id)) {
      rang.current.add(current.session_id);
      try { playFor("session_ending", `due-${current.session_id}`); } catch { /* sound is a courtesy */ }
    }
  }, [current?.session_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!asks || !current) return null;

  // The seat line every surface prints (2026-11-22): «№4 · Hall VIP».
  const seat = current.place ? numberNameLine(current.place.number ?? current.place.id, current.place.name) : `#${current.session_id}`;
  const aheadWays = Object.entries(current.prepaid_by_method ?? {})
    .filter(([, a]) => Number(a) > 0)
    .map(([m, a]) => `${methodName({ method: m, label: null }, t)} ${money(Number(a), centsWhenFractional(Number(a)))}`).join(" · ");

  const answer = (kind: "paid" | "take") => {
    setPay(emptyPaymentDraft(kind === "paid" ? paidAheadMethod(current) : "cash"));
    setErr(null);
    setStep(kind);
  };
  const postpone = () => {
    later.current.set(current.session_id, Date.now() + DUE_LATER_MS);
    setDues((list) => [...list]);
  };
  const save = async () => {
    if (!check.ok || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await sessionRepository.confirmDue(current.session_id, paymentBody(pay, check));
      answered.current.set(current.session_id, step === "paid" ? "paid" : "taken");
      notify.message("success", fmt(t("dueConfirm.done"), seat));
      setDues((list) => list.filter((d) => d.session_id !== current.session_id));
      load();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : t("session.failUnknown"));
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : postpone}>
      <div className="card due-confirm" role="alertdialog" aria-modal="true" data-testid="due-confirm">
        <h2 className="due-confirm__title">{fmt(t("dueConfirm.title"), seat)}</h2>
        {current.items.length > 0 && (
          <ul className="due-confirm__items" data-testid="due-confirm-items">
            {current.items.map((i, n) => (
              <li key={`${i.name}-${n}`}>
                <span>{i.name} × {i.qty}</span>
                <strong>{money(Number(i.price) * i.qty, centsWhenFractional(Number(i.price) * i.qty))}</strong>
              </li>
            ))}
          </ul>
        )}
        <div className="due-confirm__due" data-testid="due-confirm-due">
          <span>{t("dueConfirm.due")}</span>
          <strong>{money(Number(current.due), centsWhenFractional(Number(current.due)))}</strong>
        </div>
        {aheadWays !== "" && <span className="muted" data-testid="due-confirm-ahead">{fmt(t("dueConfirm.ahead"), aheadWays)}</span>}

        {step === "ask" ? (
          <>
            <p className="due-confirm__question">{t(current.items.length > 0 ? "dueConfirm.questionItems" : "dueConfirm.question")}</p>
            <div className="due-confirm__answers">
              <Button onClick={() => answer("paid")} data-testid="due-confirm-yes">{t("dueConfirm.yes")}</Button>
              <Button variant="secondary" onClick={() => answer("take")} data-testid="due-confirm-no">{t("dueConfirm.no")}</Button>
            </div>
            <button type="button" className="cp-link-btn due-confirm__later" onClick={postpone} data-testid="due-confirm-later">{t("dueConfirm.later")}</button>
          </>
        ) : (
          <>
            <p className="due-confirm__question">{t(step === "paid" ? "dueConfirm.howPaid" : "dueConfirm.takeNow")}</p>
            <PaymentEditor
              name={`due-${current.session_id}`}
              branchId={current.branch_id}
              dueCents={dueCents}
              value={pay}
              onChange={(next) => { setPay(next); setErr(null); }}
              check={check}
              money={money}
              disabled={busy}
            />
            {!check.ok && check.problem !== null && <span className="muted">{t(PAYMENT_PROBLEM_KEY[check.problem])}</span>}
            {err && <div className="error" role="alert" data-testid="due-confirm-error">{err}</div>}
            <div className="due-confirm__answers">
              <Button variant="secondary" onClick={() => setStep("ask")} disabled={busy}>{t("action.back")}</Button>
              <Button onClick={() => void save()} disabled={!check.ok || busy} data-testid="due-confirm-save">{t("dueConfirm.save")}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default DueConfirmNotifier;
