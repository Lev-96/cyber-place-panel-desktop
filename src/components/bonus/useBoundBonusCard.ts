import { useEffect, useState } from "react";
import { bonusRepository } from "@/repositories/BonusRepository";
import type { IBonusAccount } from "@/types/bonus";

/**
 * The Club Card bound to a seat (2026-11-25), read so «Бонусы» can be offered
 * with its balance (Stop, «+ Время»). A read that fails offers no bonuses and
 * blocks nothing. The setter is for a card bound on the same screen.
 */
export const useBoundBonusCard = (branchId: number, accountId: number | null | undefined) => {
  const [card, setCard] = useState<IBonusAccount | null>(null);
  useEffect(() => {
    let alive = true;
    if (accountId) {
      void bonusRepository.account(branchId, accountId).then((a) => { if (alive) setCard(a); }).catch(() => undefined);
    } else {
      setCard(null);
    }
    return () => { alive = false; };
  }, [branchId, accountId]);
  return [card, setCard] as const;
};

/** The Club Card on a seat known only by its id (a changed way of paying, 2026-11-25). */
export const useSessionBonusCard = (sessionId: number | null) => {
  const [card, setCard] = useState<IBonusAccount | null>(null);
  useEffect(() => {
    let alive = true;
    if (sessionId) {
      void bonusRepository.sessionCard(sessionId).then((a) => { if (alive) setCard(a); }).catch(() => undefined);
    } else {
      setCard(null);
    }
    return () => { alive = false; };
  }, [sessionId]);
  return card;
};
