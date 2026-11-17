import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import { fmt } from "@/i18n/translations";
import { sessionRepository } from "@/repositories/SessionRepository";
import type { ISessionApi } from "@/types/sessions";
import { useEffect, useState } from "react";

interface Props {
  session: ISessionApi;
  disabled: boolean;
  /** The dialog's own runner: keeps the server's answer, shows its refusal. */
  run: (action: () => Promise<ISessionApi>, attemptedMinutes?: number | null, successToast?: string | null) => Promise<boolean>;
  t: (k: string) => string;
  money: (n: number) => string;
}

/** A price per hour as typed: a figure above 0, or null. */
const rateOf = (box: string): number | null => {
  const n = Number(box.replace(",", "."));
  return box.trim() !== "" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/**
 * «Свои продукты» as the seat's RATE, during the game (2026-11-17, owner: a
 * 2 500/h VIP seat whose player brought their own food at 4 000 is a 4 000/h
 * seat, and the price per hour may be changed while they play).
 *
 * Shown only where the venue charges own food as a rate — the server's answer
 * for this seat (`start-options`: fee and mode) — or where it is already on.
 * Everything is the server's: it switches it on FROM NOW (the time before
 * keeps its price), on at another price, or off back to the seat's own rate,
 * and refuses what it will not do (paused, free) with its own sentence.
 */
const OutsideFoodRateSection = ({ session, disabled, run, t, money }: Props) => {
  const [offer, setOffer] = useState<{ fee: number | null; asRate: boolean } | null>(null);
  const on = session.outside_food_rate != null;
  const [box, setBox] = useState<string>(() => (on ? String(session.outside_food_rate) : ""));

  useEffect(() => {
    let alive = true;
    // Through a promise from the first step, so a failure of any kind —
    // thrown or rejected — leaves the section hidden, never the dialog broken.
    Promise.resolve()
      .then(() => sessionRepository.startOptions(session.pc_id))
      .then((o) => {
        if (!alive) return;
        const fee = typeof o.outside_food_fee === "number" && o.outside_food_fee > 0 ? o.outside_food_fee : null;
        setOffer({ fee, asRate: o.outside_food_mode === "tariff" });
        setBox((cur) => (cur === "" && fee !== null ? String(fee) : cur));
      })
      .catch(() => { if (alive) setOffer({ fee: null, asRate: false }); });
    return () => { alive = false; };
  }, [session.pc_id]);

  if (!on && (offer === null || !offer.asRate || offer.fee === null)) return null;

  const rate = rateOf(box);
  const perHour = t("session.perHourShort");
  const switchOn = () => {
    if (rate === null) return;
    void run(
      () => sessionRepository.setOutsideFoodRate(session.id, true, rate),
      null,
      fmt(t(on ? "session.foodRate.changedToast" : "session.foodRate.onToast"), `${money(rate)}${perHour}`),
    );
  };
  const switchOff = () => {
    void run(
      () => sessionRepository.setOutsideFoodRate(session.id, false),
      null,
      t("session.foodRate.offToast"),
    );
  };

  return (
    <section className="col" style={{ gap: 8 }} data-testid="outside-food-rate-section">
      <strong style={{ fontSize: 13 }}>{t("session.outsideFood.switch")}</strong>
      <span className="muted" style={{ fontSize: 12 }} data-testid="outside-food-rate-state">
        {on
          ? fmt(t("session.foodRate.isOn"), `${money(Number(session.outside_food_rate))}${perHour}`,
            session.rate_before_outside_food != null ? `${money(Number(session.rate_before_outside_food))}${perHour}` : "-")
          : t("session.foodRate.fromNow")}
      </span>
      <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px" }}>
          <PriceInput label={t("session.foodRate.price")} value={box} onChange={setBox} disabled={disabled} />
        </div>
        <Button
          onClick={switchOn}
          disabled={disabled || rate === null || (on && rate === Number(session.outside_food_rate))}
          data-testid="outside-food-rate-apply"
        >
          {t(on ? "session.foodRate.change" : "session.foodRate.turnOn")}
        </Button>
        {on && (
          <Button variant="secondary" onClick={switchOff} disabled={disabled} data-testid="outside-food-rate-off">
            {t("session.foodRate.turnOff")}
          </Button>
        )}
      </div>
    </section>
  );
};

export default OutsideFoodRateSection;
