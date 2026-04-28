import Button from "@/components/ui/Button";
import { formatApiError } from "@/api/errors";
import ImageUpload from "@/components/ui/ImageUpload";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
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
  const [en, setEn] = useState(initial?.name_en ?? "");
  const [ru, setRu] = useState(initial?.name_ru ?? "");
  const [am, setAm] = useState(initial?.name_am ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const body = { name_en: en, name_ru: ru, name_am: am, service_logo_path: logo };
      if (initial) await serviceRepository.update(initial.id, body);
      else await serviceRepository.create(body);
      onSaved();
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? "Edit service" : "New service"}</h2>
        <Input label="Name (EN)" value={en} onChange={(e) => setEn(e.target.value)} required maxLength={255} autoFocus />
        <Input label="Name (RU)" value={ru} onChange={(e) => setRu(e.target.value)} required maxLength={255} />
        <Input label="Name (AM)" value={am} onChange={(e) => setAm(e.target.value)} required maxLength={255} />

        <ImageUpload
          label="Logo (optional)"
          name={en}
          initialUrl={initial ? storageUri(initial.service_logo_path) : null}
          onChange={setLogo}
        />

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
};


export default ServiceForm;
