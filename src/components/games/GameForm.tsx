import Button from "@/components/ui/Button";
import { formatApiError } from "@/api/errors";
import { existingGameOf, type ExistingGame } from "@/api/gameExists";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PlatformPicker from "@/components/ui/PlatformPicker";
import { useLang } from "@/i18n/LanguageContext";
import { renderText, textLiteral, type LocalizedText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import { gameRepository } from "@/repositories/GameRepository";
import { IGameApi } from "@/api/games";
import { findExistingGame } from "@/utils/gameName";
import { platformLabel } from "@/utils/platform";
import { FormEvent, useRef, useState } from "react";

interface Props {
  initial?: IGameApi;
  /** Scope the new game to this branch (game_branches pivot). */
  branchId?: number;
  /**
   * Fix the platform to a specific slug and hide the picker. Used when a
   * game is created inline for a place's custom platform — the platform is
   * already decided, the operator only names the game.
   *
   * Passing it at all locks the platform, even when it is EMPTY (a place on
   * "Other" not yet named): then there is no platform to create the game on
   * and Save stays disabled. An empty lock must never fall back to the
   * picker — that would let a place form create a game on any platform.
   */
  lockedPlatform?: string;
  /**
   * The games already loaded on the calling screen. Lets the form spot an
   * obvious duplicate before the request — advice only; the server's 422
   * `game_exists` is what decides.
   */
  catalogue?: readonly IGameApi[];
  onClose: () => void;
  /**
   * Called after a successful save. Receives the saved row when the backend
   * returned one (create does, update doesn't) so a caller such as PlaceForm
   * can immediately pre-select the game it just created — or the existing
   * game the operator chose to use instead of a duplicate.
   */
  onSaved: (game?: IGameApi | null) => void;
}

const GameForm = ({ initial, branchId, lockedPlatform, catalogue, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [platform, setPlatform] = useState<string>(initial?.platform ?? lockedPlatform ?? "pc");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<LocalizedText | null>(null);
  /** The catalogue row this name would duplicate; drawn as a question. */
  const [conflict, setConflict] = useState<ExistingGame | null>(null);
  // `busy` alone does not stop a double submit: two clicks (or Enter + click)
  // inside one frame both read the same stale `busy === false`. A ref flips
  // synchronously, so the second call sees it.
  const inFlight = useRef(false);
  const isEdit = !!initial;
  const platformFixed = lockedPlatform !== undefined;
  const hasPlatform = platform.trim() !== "";

  const run = async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setErr(null);
    try { await work(); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // While the duplicate question is on screen, Enter must not resend the
    // same create: the operator answers with one of the two buttons.
    if (conflict || (!isEdit && !hasPlatform)) return;
    void run(async () => {
      try {
        if (isEdit) {
          // Backend's Games/UpdateRequest only accepts `name` reliably (platform validator
          // is bugged: expects array of uppercase). So on edit we update name only.
          onSaved(await gameRepository.update(initial!.id, { name }));
          return;
        }
        const known = findExistingGame(catalogue, name, platform);
        if (known) { setConflict(known); return; }
        onSaved(await gameRepository.create({ name, platform, branch_id: branchId }));
      } catch (ex) {
        const existing = existingGameOf(ex);
        if (existing) setConflict(existing);
        else setErr(textLiteral(formatApiError(ex)));
      }
    });
  };

  const chooseExisting = () => {
    const game = conflict;
    if (!game) return;
    void run(async () => {
      // The global catalogue (admin, no branch): the game is already there and
      // there is nothing to link it to — the answer is simply that row.
      if (branchId === undefined) { onSaved(game); return; }
      try {
        const linked = await gameRepository.create({ name, platform, branch_id: branchId, use_existing: true });
        onSaved(linked ?? game);
      } catch (ex) {
        // A second `game_exists` means a backend that does not know
        // `use_existing` yet: say what it said instead of asking again.
        setConflict(null);
        setErr(textLiteral(formatApiError(ex)));
      }
    });
  };

  const onNameChange = (v: string) => {
    setName(v);
    // A different name is a different question.
    if (conflict) setConflict(null);
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 380, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{isEdit ? t("game.titleEdit") : t("game.titleNew")}</h2>
        <Input label={t("label.name")} value={name} onChange={(e) => onNameChange(e.target.value)} required autoFocus />
        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("label.platform")}</span>
          {platformFixed ? (
            <div className="input" style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>
              {hasPlatform ? platformLabel(platform) : "-"}
            </div>
          ) : (
            <PlatformPicker value={platform} onChange={setPlatform} disabled={isEdit} />
          )}
          {isEdit && <span className="muted" style={{ fontSize: 11 }}>{t("game.platformLocked")}</span>}
        </div>
        {conflict && (
          <div role="alert" className="card" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10, borderColor: "#07ddf1" }}>
            <span>{fmt(t("game.exists.notice"), conflict.name, platformLabel(conflict.platform))}</span>
            <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button type="button" variant="secondary" onClick={() => setConflict(null)} disabled={busy}>{t("action.cancel")}</Button>
              <Button type="button" onClick={chooseExisting} disabled={busy}>{t("game.exists.useExisting")}</Button>
            </div>
          </div>
        )}
        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{renderText(err, t)}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy || !!conflict || (!isEdit && !hasPlatform)}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};


export default GameForm;
