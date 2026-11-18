import { formatApiError } from "@/api/errors";
import { stockCountRequiredBody } from "@/api/shifts";
import { type LocalizedText, textKey, textLiteral } from "@/i18n/localizedText";
import { shiftRepository } from "@/repositories/ShiftRepository";
import type { IAcceptanceProduct, IStockCountEntry } from "@/types/shifts";
import { notify } from "@/ui/notify";
import { newRequestId } from "@/utils/requestId";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CountValues, stockCountsOf, withMissing } from "./acceptanceCount";

/**
 * Opening a shift with «Приём смены» (2026-11-18).
 *
 * The press reads what must be counted (fresh: a product may have started
 * being counted since the screen loaded). Nothing to count: the shift opens
 * at once, still sending `stock_counts: []`. Otherwise the count step opens;
 * its Open sends every product's count.
 *
 * ONE `client_request_id` per attempt, minted on the first send and sent
 * again on every retry (a lost answer, a 422, a 5xx), so a request the server
 * already carried out is answered, never repeated. It is dropped once the
 * shift is open (ours or somebody else's): the server answers a known id with
 * its shift even after that shift is closed.
 *
 * 409: somebody opened it a moment ago, said by `onAlreadyOpen`, not as an
 * error. 422 `stock_count_required`: the step names the products the count
 * missed (adding any the list did not have).
 */
export interface AcceptanceStep {
  products: IAcceptanceProduct[];
  /** Products the server said were not counted, to highlight. */
  missingIds: number[];
  error: LocalizedText | null;
}

interface Options {
  /** A shift is open now (the screen's last read): the attempt is over. */
  isOpen: boolean;
  /** After every answer: re-read the screen. */
  onSettled: () => void;
  onAlreadyOpen: () => void;
}

export const useShiftOpening = (branchId: number, { isOpen, onSettled, onAlreadyOpen }: Options) => {
  const [step, setStep] = useState<AcceptanceStep | null>(null);
  const [values, setValues] = useState<CountValues>({});
  const [busy, setBusy] = useState(false);
  /** An error outside the step (reading the list, an open with nothing to count). */
  const [error, setError] = useState<LocalizedText | null>(null);
  const attemptId = useRef<string | null>(null);
  /** Synchronous guard: clicks arrive before the disabled button re-renders. */
  const inFlight = useRef(false);
  const openingCash = useRef("0.00");

  useEffect(() => {
    if (isOpen) attemptId.current = null;
  }, [isOpen]);

  const send = useCallback(async (products: IAcceptanceProduct[], counts: IStockCountEntry[]) => {
    attemptId.current ??= newRequestId();
    try {
      await shiftRepository.open({
        branch_id: branchId,
        opening_cash: openingCash.current,
        client_request_id: attemptId.current,
        stock_counts: counts,
      });
      attemptId.current = null;
      setStep(null);
      setValues({});
      if (counts.length > 0) notify.success("shift", "accepted");
    } catch (e) {
      const refusal = stockCountRequiredBody(e);
      if ((e as { status?: number }).status === 409) {
        attemptId.current = null;
        setStep(null);
        onAlreadyOpen();
      } else if (refusal) {
        setStep({
          products: withMissing(products, refusal),
          missingIds: refusal.missing.map((m) => m.product_id),
          error: textKey("shift.accept.missing"),
        });
      } else if (products.length > 0) {
        setStep({ products, missingIds: [], error: textLiteral(formatApiError(e)) });
      } else {
        setError(textLiteral(formatApiError(e)));
      }
    } finally {
      onSettled();
    }
  }, [branchId, onAlreadyOpen, onSettled]);

  /** The Open press on the screen: what must be counted, then the step or the open itself. */
  const start = useCallback(async (cash: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    openingCash.current = cash;
    try {
      const products = await shiftRepository.acceptanceProducts(branchId);
      if (products.length === 0) await send([], []);
      else setStep({ products, missingIds: [], error: null });
    } catch (e) {
      setError(textLiteral(formatApiError(e)));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [branchId, send]);

  /** The step's Open: every product counted, or nothing is sent. */
  const confirm = useCallback(async () => {
    if (!step || inFlight.current) return;
    const counts = stockCountsOf(step.products, values);
    if (counts === null) return;
    inFlight.current = true;
    setBusy(true);
    setStep({ ...step, error: null });
    try {
      await send(step.products, counts);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [step, values, send]);

  const setValue = useCallback((productId: number, raw: string) => {
    setValues((v) => ({ ...v, [productId]: raw }));
  }, []);

  /** Leave the step; what was typed stays for the next press. */
  const cancel = useCallback(() => setStep(null), []);

  return { step, values, busy, error, start, confirm, setValue, cancel };
};
