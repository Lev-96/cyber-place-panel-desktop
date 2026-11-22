import type { ISessionApi } from "@/types/sessions";
import { useSyncExternalStore } from "react";

/**
 * The open bills as `OpenBillsNotifier` last read them from the server
 * (2026-11-22, owner), shared with whatever shows them elsewhere — the board
 * marks each seat that has one, and a click there opens that bill in the
 * notifier. One reader of the server (the notifier), so nothing here ever
 * reads or computes anything: it is the server's list, as it came.
 */
type Listener = () => void;

const EMPTY: readonly ISessionApi[] = Object.freeze([]);
let current: readonly ISessionApi[] = EMPTY;
const listeners = new Set<Listener>();
const openers = new Set<(sessionId: number) => void>();
/** The board opens a running seat's bill itself (its console path); true = handled. */
const boardOpeners = new Set<(sessionId: number) => boolean>();

const subscribe = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** The notifier publishes each list it read (and `[]` when it unmounts). */
export const publishOpenBills = (list: readonly ISessionApi[]): void => {
  current = list.length === 0 ? EMPTY : list;
  for (const fn of [...listeners]) {
    try { fn(); } catch { /* a listener's failure is its own */ }
  }
};

/** The open bills now, re-rendering when they change. */
export const useOpenBills = (): readonly ISessionApi[] => useSyncExternalStore(subscribe, () => current, () => EMPTY);

/** The notifier opens a bill when asked; the returned function stops it. */
export const onOpenBillRequested = (fn: (sessionId: number) => void): (() => void) => {
  openers.add(fn);
  return () => { openers.delete(fn); };
};

/**
 * The sessions board, while it is on screen, opens a RUNNING seat's bill (one
 * at the till) itself: its confirm is the board's own Stop path, which also
 * sends that seat's console to rest. It returns true when it took the bill.
 */
export const onBoardOpenBillRequested = (fn: (sessionId: number) => boolean): (() => void) => {
  boardOpeners.add(fn);
  return () => { boardOpeners.delete(fn); };
};

/** Somebody pressed a seat's «Счёт не закрыт»: open that bill — once. Never throws. */
export const requestOpenBill = (sessionId: number): void => {
  for (const fn of [...boardOpeners]) {
    try { if (fn(sessionId)) return; } catch { /* the opener's failure is its own */ }
  }
  for (const fn of [...openers]) {
    try { fn(sessionId); } catch { /* the opener's failure is its own */ }
  }
};

/**
 * The bill just put away (2026-11-22, owner): where it went is lit for a few
 * seconds — its seat in «Незакрытые счета» and the chip on its tile — so the
 * cashier sees where to bring it back from.
 */
export const JUST_PUT_AWAY_MS = 4000;
let justPutAway: number | null = null;
let putAwayTimer: ReturnType<typeof setTimeout> | null = null;
const putAwayListeners = new Set<Listener>();
const subscribePutAway = (fn: Listener): (() => void) => {
  putAwayListeners.add(fn);
  return () => { putAwayListeners.delete(fn); };
};
const notifyPutAway = () => {
  for (const fn of [...putAwayListeners]) {
    try { fn(); } catch { /* a listener's failure is its own */ }
  }
};

/** A bill was just put away: light where it went. */
export const markPutAway = (sessionId: number): void => {
  justPutAway = sessionId;
  if (putAwayTimer) clearTimeout(putAwayTimer);
  putAwayTimer = setTimeout(() => { justPutAway = null; putAwayTimer = null; notifyPutAway(); }, JUST_PUT_AWAY_MS);
  notifyPutAway();
};

/** The session whose bill was just put away, for {@link JUST_PUT_AWAY_MS}; else null. */
export const useJustPutAway = (): number | null => useSyncExternalStore(subscribePutAway, () => justPutAway, () => null);

/**
 * Bills on screen right now (the board's open receipt): never reminded about
 * while the cashier is looking at them (2026-11-22).
 */
const shown = new Set<number>();
export const setBillShown = (sessionId: number, on: boolean): void => {
  if (on) shown.add(sessionId);
  else shown.delete(sessionId);
};
export const isBillShown = (sessionId: number): boolean => shown.has(sessionId);

/**
 * A sessions board is on screen (2026-11-22, owner): it shows «Незакрытые
 * счета» itself, in its header, so the app-wide corner chip steps aside.
 */
let boardsOnScreen = 0;
const boardListeners = new Set<Listener>();
const subscribeBoards = (fn: Listener): (() => void) => {
  boardListeners.add(fn);
  return () => { boardListeners.delete(fn); };
};
export const boardOnScreen = (): (() => void) => {
  boardsOnScreen++;
  for (const fn of [...boardListeners]) fn();
  return () => {
    boardsOnScreen = Math.max(0, boardsOnScreen - 1);
    for (const fn of [...boardListeners]) fn();
  };
};
export const useBoardOnScreen = (): boolean => useSyncExternalStore(subscribeBoards, () => boardsOnScreen > 0, () => false);
