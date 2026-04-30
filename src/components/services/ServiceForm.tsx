import Button from "@/components/ui/Button";
import { formatApiError } from "@/api/errors";
import ImageUpload from "@/components/ui/ImageUpload";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { storageUri } from "@/infrastructure/AppConfig";
import { serviceRepository } from "@/repositories/ServiceRepository";
import { IBranchService } from "@/types/api";
import { FormEvent, useState } from "react";

interface Props {
  initial?: IBranchService;
  onClose: () => void;
  onSaved: () => void;
}

const ServiceForm = ({ initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [en, setEn] = useState(initial?.name_en ?? "");
  const [ru, setRu] = useState(initial?.name_ru ?? "");
  const [am, setAm] = useState(initial?.name_am ?? "");
  const [price, setPrice] = useState<string>(initial?.price != null ? String(initial.price) : "");
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const priceNum = price.trim() === "" ? null : Number(price.replace(",", "."));
      const body = { name_en: en, name_ru: ru, name_am: am, price: priceNum, service_logo_path: logo };
      if (initial) await serviceRepository.update(initial.id, body);
      else await serviceRepository.create(body);
      onSaved();
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("service.edit") : t("service.new")}</h2>
        <Input label={t("service.nameEn")} value={en} onChange={(e) => setEn(e.target.value)} required maxLength={255} autoFocus />
        <Input label={t("service.nameRu")} value={ru} onChange={(e) => setRu(e.target.value)} required maxLength={255} />
        <Input label={t("service.nameAm")} value={am} onChange={(e) => setAm(e.target.value)} required maxLength={255} />
        <Input
          label={t("service.price")}
          inputMode="decimal"
          placeholder="1000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <ImageUpload
          label={t("service.logo")}
          name={en}
          initialUrl={initial ? storageUri(initial.service_logo_path) : null}
          onChange={setLogo}
        />

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};


export default ServiceForm;
