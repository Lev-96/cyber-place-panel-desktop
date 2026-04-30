import Button from "@/components/ui/Button";
import { formatApiError } from "@/api/errors";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { gameRepository } from "@/repositories/GameRepository";
import { IGameApi } from "@/api/games";
import { PlatformType } from "@/types/api";
import { FormEvent, useState } from "react";

interface Props {
  initial?: IGameApi;
  onClose: () => void;
  onSaved: () => void;
}

const PLATFORMS: PlatformType[] = ["pc", "ps4", "ps5"];

const GameForm = ({ initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [platform, setPlatform] = useState<PlatformType>(initial?.platform ?? "pc");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!initial;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (isEdit) {
        // Backend's Games/UpdateRequest only accepts `name` reliably (platform validator
        // is bugged: expects array of uppercase). So on edit we update name only.
        await gameRepository.update(initial!.id, { name });
      } else {
        await gameRepository.create({ name, platform });
      }
      onSaved();
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 380, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{isEdit ? t("game.titleEdit") : t("game.titleNew")}</h2>
        <Input label={t("label.name")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("label.platform")}</span>
          <div className="row" style={{ gap: 6 }}>
            {PLATFORMS.map((p) => (
              <Button key={p} type="button" variant={platform === p ? "primary" : "secondary"} onClick={() => !isEdit && setPlatform(p)} disabled={isEdit} style={{ flex: 1 }}>{p.toUpperCase()}</Button>
            ))}
          </div>
          {isEdit && <span className="muted" style={{ fontSize: 11 }}>{t("game.platformLocked")}</span>}
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


export default GameForm;
