import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import { RANKS, type IBonusSettings, type IRankSettings, type Rank, type RankStrategy, type RankThresholds } from "@/types/bonus";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";
import RankBadge from "./RankBadge";

interface Props {
  branchId: number;
  settings: IRankSettings;
  onSaved: (s: IBonusSettings) => void;
}

const STRATEGIES: RankStrategy[] = ["none", "hours", "visits", "spent"];
const UPPER = ["pro", "elite", "veteran", "legend"] as const;
/** A sensible start for each measure, shown until the owner types their own. */
const SUGGESTED: Record<Exclude<RankStrategy, "none">, RankThresholds> = {
  hours: { pro: 3, elite: 10, veteran: 30, legend: 100 },
  visits: { pro: 3, elite: 10, veteran: 25, legend: 60 },
  spent: { pro: 10000, elite: 50000, veteran: 150000, legend: 400000 },
};

/** The standard names (the server's `BonusRank::DEFAULT_NAMES`): a field left empty shows these. */
const STANDARD: Record<Rank, string> = { gamer: "GAMER", pro: "PRO", elite: "ELITE", veteran: "VETERAN", legend: "LEGEND" };
const NAME_MAX = 16;

const parse = (raw: string): number => {
  const s = raw.trim().replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
};

/**
 * The owner's rank rule (2026-11-25): what moves a card up — hours played,
 * days visited or money spent — and where each rank starts. GAMER is where
 * every card begins. The server re-ranks every card when this is saved.
 */
const RankSettingsForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const [strategy, setStrategy] = useState<RankStrategy>(settings.strategy);
  const start = settings.thresholds ?? SUGGESTED[settings.strategy === "none" ? "hours" : settings.strategy];
  const [values, setValues] = useState<Record<(typeof UPPER)[number], string>>({
    pro: String(start.pro), elite: String(start.elite), veteran: String(start.veteran), legend: String(start.legend),
  });
  // The owner's own names (2026-11-25): empty = the standard name.
  const [names, setNames] = useState<Record<Rank, string>>(() => {
    const out = { gamer: "", pro: "", elite: "", veteran: "", legend: "" } as Record<Rank, string>;
    for (const r of RANKS) { const n = settings.names?.[r]; out[r] = n && n !== STANDARD[r] ? n : ""; }
    return out;
  });
  const shown = (r: Rank) => names[r].trim() || STANDARD[r];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nums = UPPER.map((k) => parse(values[k]));
  const rising = nums.every((n, i) => Number.isFinite(n) && n > 0 && (i === 0 || n > nums[i - 1]));
  const valid = strategy === "none" || rising;

  const pick = (s: RankStrategy) => {
    setStrategy(s);
    // A new measure starts from its own sensible numbers, unless it is the saved one.
    if (s !== "none") {
      const base = s === settings.strategy && settings.thresholds ? settings.thresholds : SUGGESTED[s];
      setValues({ pro: String(base.pro), elite: String(base.elite), veteran: String(base.veteran), legend: String(base.legend) });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const own = settings.names !== undefined ? { names: Object.fromEntries(RANKS.map((r) => [r, names[r].trim()])) } : {};
      const body = strategy === "none" ? { strategy, ...own } : { strategy, thresholds: { pro: nums[0], elite: nums[1], veteran: nums[2], legend: nums[3] }, ...own };
      const saved = await bonusRepository.updateRanks(branchId, body);
      notify.message("success", t("bonus.settings.saved"));
      onSaved(saved);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit} data-testid="rank-settings">
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label={t("bonus.rank.strategy")}>
        {STRATEGIES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={strategy === s} disabled={busy}
            className={"btn " + (strategy === s ? "" : "secondary")} onClick={() => pick(s)} data-testid={`rank-strategy-${s}`}>
            {t(`bonus.rank.by.${s}`)}
          </button>
        ))}
      </div>
      {strategy !== "none" && (
        <div className="col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <RankBadge rank="gamer" label={shown("gamer")} /><span className="muted" style={{ fontSize: 13 }}>{t("bonus.rank.start")}</span>
          </div>
          {UPPER.map((k, i) => (
            <label key={k} className="row" style={{ gap: 10, alignItems: "center" }}>
              <span style={{ width: 96 }}><RankBadge rank={k} label={shown(k)} /></span>
              <span className="muted" style={{ fontSize: 13, minWidth: 40 }}>{t("bonus.rank.from")}</span>
              <input className="input" type="text" inputMode="decimal" value={values[k]} disabled={busy} style={{ width: 120 }}
                aria-invalid={!Number.isFinite(nums[i]) || nums[i] <= 0 || (i > 0 && nums[i] <= nums[i - 1])}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} data-testid={`rank-threshold-${k}`} />
              <span className="muted" style={{ fontSize: 13 }}>{t(`bonus.rank.unit.${strategy}`)}</span>
            </label>
          ))}
          {!rising && <span className="error" style={{ fontSize: 13 }}>{t("bonus.rank.mustRise")}</span>}
        </div>
      )}
      <span className="muted" style={{ fontSize: 12 }}>{t(strategy === "none" ? "bonus.rank.noneHint" : "bonus.rank.hint")}</span>
      {settings.names !== undefined && (
        <div className="col" style={{ gap: 8 }} data-testid="rank-names">
          <strong style={{ fontSize: 14 }}>{t("bonus.rank.namesTitle")}</strong>
          <span className="muted" style={{ fontSize: 12 }}>{t("bonus.rank.namesHint")}</span>
          {RANKS.map((r) => (
            <label key={r} className="row" style={{ gap: 10, alignItems: "center" }}>
              <span style={{ width: 96 }}><RankBadge rank={r} label={shown(r)} /></span>
              <input className="input" type="text" value={names[r]} placeholder={STANDARD[r]} maxLength={NAME_MAX} disabled={busy} style={{ width: 200 }}
                onChange={(e) => setNames((v) => ({ ...v, [r]: e.target.value }))} data-testid={`rank-name-${r}`} aria-label={STANDARD[r]} />
            </label>
          ))}
        </div>
      )}
      {err && <div className="error">{err}</div>}
      <div><Button type="submit" disabled={!valid || busy} data-testid="rank-save">{t("action.save")}</Button></div>
    </form>
  );
};

export default RankSettingsForm;
