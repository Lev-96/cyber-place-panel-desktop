import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import { fmt } from "@/i18n/translations";
import { sessionRepository } from "@/repositories/SessionRepository";
import type { ISessionApi } from "@/types/sessions";
import { useState } from "react";

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

/** The price per hour the seat runs on now, as the server reports it. */
export const currentRate = (s: ISessionApi): number | null => {
  const r = Number(s.tariff_hourly_rate ?? s.hourly_rate);
  return Number.isFinite(r) && r > 0 ? r : null;
};

/**
 * The seat's price per hour, changed during the game (2026-11-19, owner:
 * 1 000/h → 800/h, by the manager or owner). The server does it FROM NOW —
 * the time before keeps its price — and refuses what it will not do (paused,
 * a sold block with no hourly price) with its own sentence. Nothing is
 * computed here: the board and the receipt read the server's answer.
 *
 * Not shown on a free seat (no price) or with «Свои продукты» as the rate
 * (that price is changed in its own section, which owns the way back).
 */
const HourlyRateSection = ({ session, disabled, run, t, money }: Props) => {
  const now = currentRate(session);
  const [box, setBox] = useState<string>(() => (now !== null ? String(now) : ""));

  if (session.is_free || session.outside_food_rate != null || now === null) return null;

  const rate = rateOf(box);
  const perHour = t("session.perHourShort");
  const save = () => {
    if (rate === null) return;
    void run(
      () => sessionRepository.setHourlyRate(session.id, rate),
      null,
      fmt(t("session.rate.savedToast"), `${money(rate)}${perHour}`),
    );
  };

  return (
    <section className="col" style={{ gap: 8 }} data-testid="hourly-rate-section">
      <strong style={{ fontSize: 13 }}>{t("session.rate.title")}</strong>
      <span className="muted" style={{ fontSize: 12 }} data-testid="hourly-rate-now">
        {fmt(t("session.rate.now"), `${money(now)}${perHour}`)}
      </span>
      <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px" }}>
          <PriceInput label={t("session.rate.title")} value={box} onChange={setBox} disabled={disabled} />
        </div>
        <Button onClick={save} disabled={disabled || rate === null || rate === now} data-testid="hourly-rate-save">
          {t("session.rate.save")}
        </Button>
      </div>
    </section>
  );
};

export default HourlyRateSection;
