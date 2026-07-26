import Button from "@/components/ui/Button";
import { formatApiError } from "@/api/errors";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PlatformPicker from "@/components/ui/PlatformPicker";
import { useLang } from "@/i18n/LanguageContext";
import { gameRepository } from "@/repositories/GameRepository";
import { IGameApi } from "@/api/games";
import { platformLabel } from "@/utils/platform";
import { FormEvent, useState } from "react";

interface Props {
  initial?: IGameApi;
  /** Scope the new game to this branch (game_branches pivot). */
  branchId?: number;
  /**
   * Fix the platform to a specific slug and hide the picker. Used when a
   * game is created inline for a place's custom platform — the platform is
   * already decided, the operator only names the game.
   */
  lockedPlatform?: string;
  onClose: () => void;
  /**
   * Called after a successful save. Receives the saved row when the backend
   * returned one (create does, update doesn't) so a caller such as PlaceForm
   * can immediately pre-select the game it just created.
   */
  onSaved: (game?: IGameApi | null) => void;
}

const GameForm = ({ initial, branchId, lockedPlatform, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [platform, setPlatform] = useState<string>(initial?.platform ?? lockedPlatform ?? "pc");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!initial;
  const platformFixed = !!lockedPlatform;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (isEdit) {
        // Backend's Games/UpdateRequest only accepts `name` reliably (platform validator
        // is bugged: expects array of uppercase). So on edit we update name only.
        onSaved(await gameRepository.update(initial!.id, { name }));
      } else {
        onSaved(await gameRepository.create({ name, platform, branch_id: branchId }));
      }
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
          {platformFixed ? (
            <div className="input" style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>
              {platformLabel(platform)}
            </div>
          ) : (
            <PlatformPicker value={platform} onChange={setPlatform} disabled={isEdit} />
          )}
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
