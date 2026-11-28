import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import HoursRange from "./HoursRange";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import type { IBonusSettings } from "@/types/bonus";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  settings: IBonusSettings;
  onSaved: (s: IBonusSettings) => void;
}

const SAMPLE = 1000;

/** "5", "5.5", "5,5" → 5.5; anything else → NaN. */
const parseAmount = (raw: string): number => {
  const s = raw.trim().replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
};

/**
 * The owner's bonus rule for one branch: on/off, the percent of a paid
 * session that goes onto the card, and what a new card starts with.
 * The worked example shows the answer before it reaches a player.
 */
const BonusSettingsForm = ({ branchId, settings, onSaved }: Props) => {
  const { t, money } = useLang();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [percent, setPercent] = useState(String(Number(settings.percent)));
  const [welcome, setWelcome] = useState(String(Number(settings.welcome)));
  // The earning hours (2026-11-25): off = every game earns, as before.
  const [hoursOn, setHoursOn] = useState(settings.earn_from != null && settings.earn_to != null);
  const [earnFrom, setEarnFrom] = useState(settings.earn_from ?? "10:00");
  const [earnTo, setEarnTo] = useState(settings.earn_to ?? "16:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const p = parseAmount(percent);
  const w = parseAmount(welcome);
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  const hoursOk = !hoursOn || (clock.test(earnFrom) && clock.test(earnTo) && earnFrom !== earnTo);
  const valid = Number.isFinite(p) && p >= 0 && p <= 100 && Number.isFinite(w) && w >= 0 && w <= 9_999_999 && hoursOk;
  const hoursChanged = hoursOn !== (settings.earn_from != null && settings.earn_to != null)
    || (hoursOn && (earnFrom !== settings.earn_from || earnTo !== settings.earn_to));
  const changed = enabled !== settings.enabled || p !== Number(settings.percent) || w !== Number(settings.welcome) || hoursChanged;
  // The server's own rule: DOWN to a whole dram.
  const earned = Number.isFinite(p) ? Math.floor((SAMPLE * p) / 100) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !changed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const saved = await bonusRepository.updateSettings(branchId, {
        enabled, percent: p, welcome: w,
        // Sent only by a server that knows them (it answered with the field).
        ...(settings.earn_from !== undefined ? { earn_from: hoursOn ? earnFrom : null, earn_to: hoursOn ? earnTo : null } : {}),
      });
      notify.message("success", t("bonus.settings.saved"));
      onSaved(saved);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit} data-testid="bonus-settings">
      <Switch checked={enabled} onChange={setEnabled} disabled={busy} label={t("bonus.settings.enabled")} />
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("bonus.settings.percent")}</span>
          <input className="input" type="text" inputMode="decimal" value={percent} disabled={busy}
            onChange={(e) => setPercent(e.target.value)} aria-invalid={!Number.isFinite(p) || p > 100} style={{ width: 120 }} data-testid="bonus-percent" />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("bonus.settings.welcome")}</span>
          <input className="input" type="text" inputMode="decimal" value={welcome} disabled={busy}
            onChange={(e) => setWelcome(e.target.value)} aria-invalid={!Number.isFinite(w)} style={{ width: 140 }} data-testid="bonus-welcome" />
        </label>
      </div>
      {settings.earn_from !== undefined && (
        <div className="col" style={{ gap: 8 }}>
          <Switch checked={hoursOn} onChange={setHoursOn} disabled={busy} label={t("bonus.settings.earnHours")} />
          {hoursOn && (
            <HoursRange from={earnFrom} to={earnTo} onChange={(f, tt) => { setEarnFrom(f); setEarnTo(tt); }} disabled={busy} testId="bonus-earn-hours" />
          )}
          <span className="muted" style={{ fontSize: 12 }} data-testid="bonus-earn-hours-rule">
            {hoursOn ? t("bonus.settings.earnHoursRule").replace("{0}", earnFrom).replace("{1}", earnTo) : t("bonus.settings.earnAlways")}
          </span>
        </div>
      )}
      <span className="muted" style={{ fontSize: 12 }}>
        {t("bonus.settings.example").replace("{0}", money(SAMPLE)).replace("{1}", String(earned))}
      </span>
      {err && <div className="error">{err}</div>}
      <div>
        <Button type="submit" disabled={!valid || !changed || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default BonusSettingsForm;
