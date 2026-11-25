import Button from "@/components/ui/Button";
import NumberStepper from "@/components/ui/NumberStepper";
import Switch from "@/components/ui/Switch";
import HoursRange from "./HoursRange";
import SeatChoice from "./SeatChoice";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import type { ITimeBonusSettings } from "@/types/bonus";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  settings: ITimeBonusSettings;
  onSaved: (s: ITimeBonusSettings) => void;
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The server's own ceiling for one grant (`SessionTimeService::MAX_MINUTES`). */
const MAX_MINUTES = 600;
const MAX_PER_WINDOW = 50;

/**
 * The owner's time bonus (2026-11-25): in these hours, this many running
 * seats WITH A LIMIT win these free minutes at random; a manager confirms
 * each. The sentence under the fields says the rule back in plain words.
 */
const TimeBonusSettingsForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [from, setFrom] = useState(settings.from ?? "13:00");
  const [to, setTo] = useState(settings.to ?? "18:00");
  const [minutes, setMinutes] = useState(settings.minutes);
  const [perWindow, setPerWindow] = useState(settings.per_window);
  // Which seats may win (2026-11-25): null = every seat.
  const [placeIds, setPlaceIds] = useState<number[] | null>(settings.place_ids ?? null);
  const savedPlaces = [...(settings.place_ids ?? [])].sort().join(",");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hoursOk = CLOCK.test(from) && CLOCK.test(to) && from !== to;
  const valid = hoursOk && Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_MINUTES
    && Number.isInteger(perWindow) && perWindow >= 1 && perWindow <= MAX_PER_WINDOW
    && (placeIds === null || placeIds.length > 0);
  const changed = enabled !== settings.enabled || from !== (settings.from ?? "") || to !== (settings.to ?? "")
    || minutes !== settings.minutes || perWindow !== settings.per_window
    || (placeIds === null) !== (settings.place_ids == null) || [...(placeIds ?? [])].sort().join(",") !== savedPlaces;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !changed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const saved = await bonusRepository.updateTimeBonus(branchId, { enabled, from, to, minutes, per_window: perWindow, place_ids: placeIds });
      notify.message("success", t("bonus.settings.saved"));
      onSaved(saved);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit} data-testid="time-bonus-settings">
      <Switch checked={enabled} onChange={setEnabled} disabled={busy} label={t("timeBonus.settings.enabled")} />
      <span className="label">{t("timeBonus.settings.hours")}</span>
      <HoursRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} disabled={busy} testId="time-bonus-hours" />
      {from !== "" && from === to && <span className="error" style={{ fontSize: 13 }} data-testid="time-bonus-same-hours">{t("timeBonus.settings.sameHours")}</span>}
      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ width: 150 }}><NumberStepper label={t("timeBonus.settings.minutes")} value={minutes} onChange={(v) => setMinutes(Math.round(v))} min={1} max={MAX_MINUTES} step={5} precision={0} disabled={busy} suffix={t("time.minShort")} /></div>
        <div style={{ width: 150 }}><NumberStepper label={t("timeBonus.settings.perWindow")} value={perWindow} onChange={(v) => setPerWindow(Math.round(v))} min={1} max={MAX_PER_WINDOW} step={1} precision={0} disabled={busy} suffix="" /></div>
      </div>
      <SeatChoice branchId={branchId} value={placeIds} onChange={setPlaceIds} disabled={busy} />
      <span className="muted" style={{ fontSize: 12 }} data-testid="time-bonus-rule">
        {t("timeBonus.settings.rule").replace("{0}", from).replace("{1}", to).replace("{2}", String(perWindow)).replace("{3}", String(minutes))}
      </span>
      {err && <div className="error">{err}</div>}
      <div>
        <Button type="submit" disabled={!valid || !changed || busy} data-testid="time-bonus-save">{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default TimeBonusSettingsForm;
