import Button from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthContext";
import { dialogToneClass } from "@/components/ui/dialogTone";
import { sessionSeatLine } from "@/components/sessions/seatLine";
import StopReceiptModal from "@/components/sessions/StopReceiptModal";
import { useLang } from "@/i18n/LanguageContext";
import { useSessionChanged } from "@/realtime/useSessionChanged";
import { sessionRepository } from "@/repositories/SessionRepository";
import type { ISessionApi } from "@/types/sessions";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DUE_POLL_MS } from "./DueConfirmNotifier";
import { onOpenBillsChanged } from "./openBillsSignal";
import { isBillShown, onOpenBillRequested, publishOpenBills, requestOpenBill, setBillShown, useBoardOnScreen, useJustPutAway } from "./openBillsStore";
import { seatLineWithKind } from "@/components/sessions/seatLine";
import { placeTypeLabelKey } from "@/utils/placeType";
import { playFor } from "@/sound/soundEngine";
import { centsWhenFractional } from "@/i18n/currency";

/**
 * A preliminary total put away is brought back to mind after this long, and
 * again every this long while it waits (2026-11-22, owner: «через 3 мин»).
 */
export const TILL_REMIND_MS = 3 * 60_000;
/** How often the waiting seats are looked at. */
export const TILL_CHECK_MS = 15_000;

/** The roles the reminder is for: the same gate as «Подтверждение оплаты». */
const STAFF = new Set(["company_owner", "manager"]);

/** 24-hour wall clock, the only format this panel shows a time in. */
const clockOf = (at: string | null | undefined): string | null =>
  at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : null;

/**
 * «Незакрытые счета» (2026-11-22, owner): the final bills nobody closed yet —
 * a seat that ended by itself and whose bill the cashier hid («Скрыть,
 * закрыть позже»), or a bill that never opened on any desk.
 *
 * The SERVER's list (`GET /sessions/open-bills`, branch-scoped, only bills
 * `POST /sessions/{id}/payment` still accepts), read on mount, every
 * {@link DUE_POLL_MS}, on window focus, on a `session.changed` of a branch with
 * an open bill, and at once when the board or a receipt says something changed
 * (`openBillsSignal`). Socket frames only trigger a read; the list is never
 * patched from one.
 *
 * A compact amber banner, bottom-centre: «Незакрытые счета: N» and each seat
 * as its card names it. A seat opens the SAME `StopReceiptModal` final bill,
 * where the cashier picks the way of paying and closes it; nothing is computed
 * here. Owners and managers only; nothing is stored (no per-user key).
 */
const OpenBillsNotifier = () => {
  const { user } = useAuth();
  const { t, lang, money } = useLang();
  // The bill just put away is lit here for a moment (2026-11-22, owner).
  const justPutAway = useJustPutAway();
  // On the sessions board its header shows them; here only elsewhere.
  const boardShown = useBoardOnScreen();
  const [expanded, setExpanded] = useState(false);
  const [bills, setBills] = useState<ISessionApi[]>([]);
  const [opened, setOpened] = useState<ISessionApi | null>(null);
  // Only the newest read is applied: an older answer landing late must not
  // bring back a bill that was just closed.
  const reads = useRef(0);
  const asks = user?.role !== undefined && STAFF.has(user.role);
  const userId = user?.id ?? null;

  const load = useCallback(() => {
    if (!asks) return;
    const mine = ++reads.current;
    sessionRepository.openBills()
      .then((list) => { if (mine === reads.current) setBills(Array.isArray(list) ? list : []); })
      .catch(() => { /* offline: read again on the next poll */ });
  }, [asks]);

  // The board marks each seat with an open bill from this same list, and a
  // press there opens it here (2026-11-22, owner). `[]` when nobody may see it.
  const billsRef = useRef<ISessionApi[]>([]);
  billsRef.current = bills;
  useEffect(() => {
    publishOpenBills(asks ? bills : []);
  }, [asks, bills]);
  useEffect(() => () => publishOpenBills([]), []);
  useEffect(() => onOpenBillRequested((id) => {
    const bill = billsRef.current.find((b) => b.id === id);
    if (bill) setOpened(bill);
  }), []);
  // The notifier's own open bill is on screen too.
  useEffect(() => {
    if (!opened) return undefined;
    setBillShown(opened.id, true);
    return () => setBillShown(opened.id, false);
  }, [opened]);

  // «Свёрнутый счёт ждёт» (2026-11-22, owner): a seat at the till whose total
  // is put away is recalled TILL_REMIND_MS after its Stop (the server's
  // `checkout_at`, the same on every desk), then every TILL_REMIND_MS — never
  // while its bill is on screen. «Напомнить позже» waits another round.
  const [reminder, setReminder] = useState<ISessionApi | null>(null);
  const reminderRef = useRef<ISessionApi | null>(null);
  reminderRef.current = reminder;
  const nextReminder = useRef(new Map<number, number>());
  useEffect(() => {
    if (!asks) return undefined;
    const tick = () => {
      const now = Date.now();
      const current = reminderRef.current;
      if (current) {
        // Closed, or opened meanwhile: the reminder goes.
        if (!billsRef.current.some((b) => b.id === current.id) || isBillShown(current.id)) setReminder(null);
        return;
      }
      for (const b of billsRef.current) {
        if (b.status !== "active" || !b.checkout_at || isBillShown(b.id)) continue;
        const due = nextReminder.current.get(b.id) ?? Date.parse(b.checkout_at) + TILL_REMIND_MS;
        if (Number.isFinite(due) && now >= due) {
          nextReminder.current.set(b.id, now + TILL_REMIND_MS);
          setReminder(b);
          try { playFor("session_unpaid", `till-${b.id}-${due}`); } catch { /* sound is a courtesy */ }
          return;
        }
      }
    };
    tick();
    const timer = window.setInterval(tick, TILL_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [asks, bills]);

  // A new open bill makes the banner pulse for a moment, so it is noticed.
  const [fresh, setFresh] = useState(false);
  const seen = useRef(0);
  useEffect(() => {
    const grew = bills.length > seen.current;
    seen.current = bills.length;
    if (!grew || bills.length === 0) return undefined;
    setFresh(true);
    const timer = window.setTimeout(() => setFresh(false), 2400);
    return () => window.clearTimeout(timer);
  }, [bills.length]);

  // A different person signed in: nothing of the previous one's list stays.
  useEffect(() => {
    setBills([]);
    setOpened(null);
  }, [userId]);

  useEffect(() => {
    if (!asks) return undefined;
    load();
    const timer = window.setInterval(load, DUE_POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const off = onOpenBillsChanged(load);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); off(); };
  }, [asks, load, userId]);

  // The banner floats over the page bottom: while it shows, the page gets
  // that much room below its last row (2026-11-22, QA), so a seat's «Старт»
  // under it can always be scrolled clear. `--open-bills-h` on <html>.
  const banner = useRef<HTMLElement | null>(null);
  const showing = asks && bills.length > 0;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = banner.current;
    if (!showing || !el) {
      root.style.removeProperty("--open-bills-h");
      return undefined;
    }
    const measure = () => root.style.setProperty("--open-bills-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    measure();
    const RO = typeof window !== "undefined" ? window.ResizeObserver : undefined;
    const ro = RO ? new RO(measure) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty("--open-bills-h"); };
  }, [showing]);

  const branchIds = useMemo(
    () => [...new Set(bills.map((b) => b.branch_id))].sort((a, b) => a - b),
    [bills],
  );

  if (!asks) return null;

  return (
    <>
      {branchIds.map((id) => <BranchListener key={id} branchId={id} onChange={load} />)}
      {bills.length > 0 && !boardShown && (
        <section
          ref={banner}
          className={`open-bills ${dialogToneClass("unpaid")}${fresh ? " is-fresh" : ""}${expanded ? " is-expanded" : ""}`}
          role="region"
          aria-label={t("openBills.title")}
          data-testid="open-bills"
        >
          {/* Compact (2026-11-22, owner): one chip in the corner; the seats a
              press away. */}
          <button
            type="button"
            className={`open-bills__toggle${bills.some((b) => b.id === justPutAway) ? " is-just-put-away" : ""}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            data-testid="open-bills-toggle"
          >
            <strong aria-live="polite" data-testid="open-bills-count">{t("openBills.chip").replace("{0}", String(bills.length))}</strong>
            <span aria-hidden>{expanded ? "▴" : "▾"}</span>
          </button>
          {expanded && (
            <div className="open-bills__seats">
              <span className="open-bills__hint">{t("openBills.hint")}</span>
              {bills.map((b) => {
                const place = b.pc?.place as { type?: string } | null | undefined;
                const seat = seatLineWithKind(sessionSeatLine(b, lang), [place?.type ? t(placeTypeLabelKey(place.type as never)) : null]);
                const atTill = b.status === "active";
                const sum = Number((atTill ? b.held_total : b.total_paid) ?? 0);
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`open-bills__seat${justPutAway === b.id ? " is-just-put-away" : ""}`}
                    onClick={() => { setExpanded(false); setOpened(b); }}
                    title={seat}
                    data-testid={`open-bill-${b.id}`}
                  >
                    <span className="open-bills__seat-name">{seat}</span>
                    <span className="open-bills__seat-at">{t(atTill ? "openBills.atTill" : "openBills.tile")}</span>
                    <strong className="open-bills__seat-sum" data-testid={`open-bill-sum-${b.id}`}>
                      {money(sum, centsWhenFractional(sum))}
                    </strong>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
      {reminder && (
        <section className={`till-reminder ${dialogToneClass("unpaid")}`} role="alertdialog" aria-labelledby="till-reminder-title" data-testid="till-reminder">
          <strong id="till-reminder-title" className="till-reminder__title">{t("openBills.remindTitle")}</strong>
          <span className="till-reminder__seat" data-testid="till-reminder-seat">{sessionSeatLine(reminder, lang)}</span>
          <strong className="till-reminder__sum">
            {money(Number(reminder.held_total ?? 0), centsWhenFractional(Number(reminder.held_total ?? 0)))}
          </strong>
          {clockOf(reminder.checkout_at) && (
            <span className="muted">{t("openBills.remindSince").replace("{0}", clockOf(reminder.checkout_at) as string)}</span>
          )}
          <div className="till-reminder__actions">
            <Button data-testid="till-reminder-open"
              onClick={() => { const id = reminder.id; setReminder(null); requestOpenBill(id); }}>
              {t("openBills.remindOpen")}
            </Button>
            <Button variant="secondary" data-testid="till-reminder-later"
              onClick={() => { nextReminder.current.set(reminder.id, Date.now() + TILL_REMIND_MS); setReminder(null); }}>
              {t("openBills.remindLater")}
            </Button>
          </div>
        </section>
      )}
      {opened && (
        <StopReceiptModal
          key={opened.id}
          session={opened}
          seat={sessionSeatLine(opened, lang)}
          onClose={() => { setOpened(null); load(); }}
          // A seat at the till put away again: it stays on the list.
          onMinimize={() => { setOpened(null); load(); }}
          // An ended seat's bill never stops anything: these are not reached.
          onConfirmed={() => { load(); }}
          onItemRemoved={() => {}}
        />
      )}
    </>
  );
};

/** One branch's `session.changed`: any change there may close or open a bill. */
const BranchListener = ({ branchId, onChange }: { branchId: number; onChange: () => void }) => {
  useSessionChanged(branchId, useCallback(() => { onChange(); }, [onChange]));
  return null;
};

export default OpenBillsNotifier;
