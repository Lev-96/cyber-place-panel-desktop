import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import TimeInput from "@/components/ui/TimeInput";
import { useLang } from "@/i18n/LanguageContext";
import { timePackageRepository } from "@/repositories/TimePackageRepository";
import { ITimePackage } from "@/types/sessions";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: ITimePackage;
  onClose: () => void;
  onSaved: (p: ITimePackage) => void;
}

// ISO weekdays 1..7 with the matching i18n key suffix the rest of the
// project uses (`branch.weekday.mon` etc.).
const WEEKDAYS: { iso: number; key: string }[] = [
  { iso: 1, key: "branch.weekday.mon" },
  { iso: 2, key: "branch.weekday.tue" },
  { iso: 3, key: "branch.weekday.wed" },
  { iso: 4, key: "branch.weekday.thu" },
  { iso: 5, key: "branch.weekday.fri" },
  { iso: 6, key: "branch.weekday.sat" },
  { iso: 7, key: "branch.weekday.sun" },
];

const PLATFORMS = ["pc", "ps4", "ps5"] as const;
type PlatformValue = "" | (typeof PLATFORMS)[number];

// Backend validates with date_format:H:i. Trim incoming "HH:MM:SS" to
// "HH:MM" for the TimeInput control, and validate user input against
// the same shape before submit.
const toHHMM = (s: string | null | undefined): string => (s ? s.slice(0, 5) : "");
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const PackageForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  // Per-locale name fields — mirrors ServiceForm so staff has the
  // same 3-input layout across both Tariffs and Services CRUD.
  const [nameEn, setNameEn] = useState(initial?.name_en ?? "");
  const [nameRu, setNameRu] = useState(initial?.name_ru ?? "");
  const [nameAm, setNameAm] = useState(initial?.name_am ?? "");
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? "60"));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  // Platform = "" means "applies to all platforms" — backend column
  // is nullable and the empty string maps to NULL on submit.
  const [platform, setPlatform] = useState<PlatformValue>(
    (initial?.platform as PlatformValue) ?? "",
  );

  // Discount sub-form. Collapsed by default unless the package being
  // edited already carries a configured discount — staff can leave it
  // off entirely and the backend stores all four columns as NULL.
  const hasInitialDiscount =
    initial?.discount_price !== undefined &&
    initial?.discount_price !== null &&
    !!initial?.discount_start_time &&
    !!initial?.discount_end_time &&
    Array.isArray(initial?.discount_days_of_week) &&
    (initial.discount_days_of_week as number[]).length > 0;

  const [discountOn, setDiscountOn] = useState<boolean>(hasInitialDiscount);
  const [discountPrice, setDiscountPrice] = useState(
    hasInitialDiscount ? String(initial?.discount_price ?? "") : "",
  );
  const [discountStart, setDiscountStart] = useState(
    hasInitialDiscount ? toHHMM(initial?.discount_start_time) : "10:00",
  );
  const [discountEnd, setDiscountEnd] = useState(
    hasInitialDiscount ? toHHMM(initial?.discount_end_time) : "22:00",
  );
  const [discountDays, setDiscountDays] = useState<number[]>(
    hasInitialDiscount && Array.isArray(initial?.discount_days_of_week)
      ? (initial!.discount_days_of_week as number[])
      : [1, 2, 3, 4, 5],
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (iso: number) => {
    setDiscountDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort(),
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const dur = Number(duration);
    const pr = Number(price);
    if (!Number.isFinite(dur) || dur <= 0) return setErr(t("tariff.errors.duration"));
    if (!Number.isFinite(pr) || pr < 0) return setErr(t("tariff.errors.price"));

    let discountPayload:
      | {
          discount_price: number | null;
          discount_start_time: string | null;
          discount_end_time: string | null;
          discount_days_of_week: number[] | null;
        }
      | Record<string, never> = {};

    if (discountOn) {
      const dp = Number(discountPrice);
      if (!Number.isFinite(dp) || dp < 0) return setErr(t("tariff.errors.discountPrice"));
      if (!HHMM_RE.test(discountStart) || !HHMM_RE.test(discountEnd)) {
        return setErr(t("tariff.errors.discountTime"));
      }
      if (discountDays.length === 0) return setErr(t("tariff.errors.discountDays"));
      discountPayload = {
        discount_price: dp,
        discount_start_time: discountStart,
        discount_end_time: discountEnd,
        discount_days_of_week: discountDays,
      };
    } else if (initial) {
      discountPayload = {
        discount_price: null,
        discount_start_time: null,
        discount_end_time: null,
        discount_days_of_week: null,
      };
    }

    setBusy(true); setErr(null);
    try {
      const nameBody = { name_en: nameEn, name_ru: nameRu, name_am: nameAm };
      const platformValue: "pc" | "ps4" | "ps5" | null =
        platform === "" ? null : platform;
      const pkg = initial
        ? await timePackageRepository.update(initial.id, {
            ...nameBody,
            duration_minutes: dur,
            price: pr,
            platform: platformValue,
            ...discountPayload,
          })
        : await timePackageRepository.create({
            branch_id: branchId,
            ...nameBody,
            duration_minutes: dur,
            price: pr,
            is_active: true,
            platform: platformValue,
            ...discountPayload,
          });
      onSaved(pkg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("tariff.titleEdit") : t("tariff.titleNew")}</h2>
        <Input label={t("tariff.nameEn")} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required autoFocus />
        <Input label={t("tariff.nameRu")} value={nameRu} onChange={(e) => setNameRu(e.target.value)} required />
        <Input label={t("tariff.nameAm")} value={nameAm} onChange={(e) => setNameAm(e.target.value)} required />
        <div>
          <span className="label">{t("tariff.platform")}</span>
          <select
            className="input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformValue)}
          >
            <option value="">{t("tariff.platformAll")}</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <Input label={t("tariff.durationMin")} type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required />
        <PriceInput
          label={t("label.price")}
          value={price}
          onChange={setPrice}
          required
        />

        {/* Optional discount sub-form. Toggle keeps the visual surface
            small for tariffs that don't carry a promo — the four
            inputs only render once the staff member opts in. */}
        <div
          style={{
            marginTop: 4,
            padding: "12px 14px",
            border: "1px solid #1f2a44",
            borderRadius: 8,
            background: "rgba(7, 221, 241, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <label className="row" style={{ gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={discountOn}
              onChange={(e) => setDiscountOn(e.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>{t("tariff.discount.toggle")}</span>
          </label>
          <div className="muted" style={{ fontSize: 12 }}>{t("tariff.discount.hint")}</div>

          {discountOn && (
            <>
              <PriceInput
                label={t("tariff.discount.price")}
                value={discountPrice}
                onChange={setDiscountPrice}
                required
              />
              <div className="row" style={{ gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <TimeInput
                    label={t("tariff.discount.startTime")}
                    value={discountStart}
                    onChange={setDiscountStart}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TimeInput
                    label={t("tariff.discount.endTime")}
                    value={discountEnd}
                    onChange={setDiscountEnd}
                    required
                  />
                </div>
              </div>
              <div>
                <span className="label">{t("tariff.discount.days")}</span>
                <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {WEEKDAYS.map((d) => {
                    const on = discountDays.includes(d.iso);
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
            </>
          )}
        </div>

        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default PackageForm;
