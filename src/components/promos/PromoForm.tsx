import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { branchPricePromoRepository } from "@/repositories/BranchPricePromoRepository";
import { IBranchPricePromo, PromoPlatform, PromoTier } from "@/types/promos";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: IBranchPricePromo;
  onClose: () => void;
  onSaved: (p: IBranchPricePromo) => void;
}

const PLATFORMS: PromoPlatform[] = ["pc", "ps4", "ps5"];
const TIERS: PromoTier[] = ["standard", "vip"];
// ISO weekdays 1..7 with the matching i18n key suffix the rest of the
// project uses (`branch.weekday.mon` etc.). Keeping the array in this
// fixed order ensures the checkbox row reads Mon → Sun every render.
const WEEKDAYS: { iso: number; key: string }[] = [
  { iso: 1, key: "branch.weekday.mon" },
  { iso: 2, key: "branch.weekday.tue" },
  { iso: 3, key: "branch.weekday.wed" },
  { iso: 4, key: "branch.weekday.thu" },
  { iso: 5, key: "branch.weekday.fri" },
  { iso: 6, key: "branch.weekday.sat" },
  { iso: 7, key: "branch.weekday.sun" },
];

// Backend validates with date_format:H:i so we trim any seconds the
// edit-mode initial value might carry ("10:00:00" → "10:00").
const toHHMM = (s: string | undefined): string => (s ? s.slice(0, 5) : "");
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const PromoForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();

  const [platform, setPlatform] = useState<PromoPlatform>(
    initial?.platform ?? "ps5",
  );
  const [tier, setTier] = useState<PromoTier>(initial?.tier ?? "standard");
  const [price, setPrice] = useState(String(initial?.discounted_price ?? ""));
  const [startTime, setStartTime] = useState(toHHMM(initial?.start_time) || "10:00");
  const [endTime, setEndTime] = useState(toHHMM(initial?.end_time) || "22:00");
  const [days, setDays] = useState<number[]>(initial?.days_of_week ?? [1, 2, 3, 4, 5]);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (iso: number) => {
    setDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort(),
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pr = Number(price);
    if (!Number.isFinite(pr) || pr < 0) return setErr(t("branch.promos.errors.price"));
    if (!HHMM_RE.test(startTime) || !HHMM_RE.test(endTime)) {
      return setErr(t("branch.promos.errors.time"));
    }
    if (days.length === 0) return setErr(t("branch.promos.errors.days"));

    setBusy(true);
    setErr(null);
    try {
      const body = {
        platform,
        tier,
        discounted_price: pr,
        start_time: startTime,
        end_time: endTime,
        days_of_week: days,
        is_active: isActive,
      };
      const promo = initial
        ? await branchPricePromoRepository.update(initial.id, body)
        : await branchPricePromoRepository.create({ branch_id: branchId, ...body });
      onSaved(promo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <form
        className="card"
        style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}
        onSubmit={submit}
      >
        <h2 style={{ margin: 0 }}>
          {initial ? t("branch.promos.titleEdit") : t("branch.promos.titleNew")}
        </h2>

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <span className="label">{t("branch.promos.platform")}</span>
            <select
              className="input"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PromoPlatform)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <span className="label">{t("branch.promos.tier")}</span>
            <select
              className="input"
              value={tier}
              onChange={(e) => setTier(e.target.value as PromoTier)}
            >
              {TIERS.map((tr) => (
                <option key={tr} value={tr}>
                  {t(`branch.prices.${tr}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label={t("branch.promos.discountedPrice")}
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input
              label={t("branch.promos.startTime")}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label={t("branch.promos.endTime")}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <span className="label">{t("branch.promos.days")}</span>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {WEEKDAYS.map((d) => {
              const on = days.includes(d.iso);
              return (
                <button
                  key={d.iso}
                  type="button"
                  className={`btn ${on ? "" : "secondary"}`}
                  style={{ minWidth: 48, padding: "6px 10px", fontSize: 13 }}
                  onClick={() => toggleDay(d.iso)}
                >
                  {t(d.key)}
                </button>
              );
            })}
          </div>
        </div>

        <label className="row" style={{ gap: 8, alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>{t("history.status.active")}</span>
        </label>

        {err && <div className="error">{err}</div>}

        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t("action.cancel")}
          </Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default PromoForm;
