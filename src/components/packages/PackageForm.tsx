import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
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

const PackageForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? "60"));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const dur = Number(duration);
    const pr = Number(price);
    if (!Number.isFinite(dur) || dur <= 0) return setErr(t("tariff.errors.duration"));
    if (!Number.isFinite(pr) || pr < 0) return setErr(t("tariff.errors.price"));
    setBusy(true); setErr(null);
    try {
      const pkg = initial
        ? await timePackageRepository.update(initial.id, { name, duration_minutes: dur, price: pr })
        : await timePackageRepository.create({ branch_id: branchId, name, duration_minutes: dur, price: pr, is_active: true });
      onSaved(pkg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("tariff.titleEdit") : t("tariff.titleNew")}</h2>
        <Input label={t("tariff.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input label={t("tariff.durationMin")} type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required />
        <Input label={t("label.price")} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
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
