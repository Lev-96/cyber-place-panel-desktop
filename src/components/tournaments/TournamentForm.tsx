import { ListSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { apiSaveEntityTranslations } from "@/api/translations";
import MultiLangInput, { LangValues, hasAnyValue, langValuesFromField, primaryValue } from "@/components/ui/MultiLangInput";
import { formatApiError } from "@/api/errors";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import Spinner from "@/components/ui/Spinner";
import { ITournamentApi, SKILL_LEVELS, SkillLevel } from "@/api/tournaments";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { gameRepository } from "@/repositories/GameRepository";
import { tournamentRepository } from "@/repositories/TournamentRepository";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: ITournamentApi;
  onClose: () => void;
  onSaved: () => void;
}

const TournamentForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t, lang } = useLang();
  const games = useAsync(() => gameRepository.list(), []);
  const branch = useAsync(() => branchRepository.byId(branchId), [branchId]);

  const [title, setTitle] = useState<LangValues>(
    () => langValuesFromField(initial?.i18n, "title", initial?.title, lang),
  );
  const [description, setDescription] = useState<LangValues>(
    () => langValuesFromField(initial?.i18n, "description", initial?.description, lang),
  );
  const [gameId, setGameId] = useState<number | "">(initial?.game_id ?? "");
  // Initial value falls back to "any" so legacy rows (created before
  // the skill_level migration) render a sensible default in the
  // edit form. Null/undefined on the wire is treated as "any".
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(initial?.skill_level ?? "any");
  const [price, setPrice] = useState(String(initial?.price ?? "0"));
  const [participantsLimit, setParticipantsLimit] = useState(String(initial?.participants_limit ?? ""));
  const [startDate, setStartDate] = useState(initial?.start_date?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!gameId) return setErr(t("tournament.errors.pickGame"));
    if (!hasAnyValue(title)) return setErr(t("product.errors.name"));
    if (!hasAnyValue(description)) return setErr(t("tournament.errors.descRequired"));
    if (!startDate) return setErr(t("tournament.errors.startRequired"));

    const companyId = branch.data?.company_id;
    if (!companyId) return setErr(t("tournament.errors.companyMissing"));

    setBusy(true); setErr(null);
    try {
      // The entity keeps a single title/description — the interface-language
      // value — so every existing consumer of `tournament.title` still works.
      // The per-language values follow in the translations call below.
      const shared = {
        game_id: Number(gameId),
        skill_level: skillLevel,
        title: primaryValue(title, lang),
        description: primaryValue(description, lang),
        price: Number(price) || 0,
        participants_limit: participantsLimit ? Number(participantsLimit) : undefined,
        start_date: startDate,
        end_date: endDate || undefined,
        source_locale: lang,
      };

      const saved = initial
        ? await tournamentRepository.update(initial.id, shared)
        : await tournamentRepository.create({
            branch_id: branchId,
            company_id: companyId,
            ...shared,
          });

      await apiSaveEntityTranslations("tournament", saved.id, {
        primary_locale: lang,
        fields: { title, description },
      });

      onSaved();
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 540, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("tournament.titleEdit") : t("tournament.titleNew")}</h2>
        <MultiLangInput
          label={t("label.title")}
          values={title}
          onChange={setTitle}
          fieldClass="tournament_title"
          maxChars={255}
          required
          autoFocus
          disabled={busy}
        />
        <MultiLangInput
          label={t("label.description")}
          values={description}
          onChange={setDescription}
          fieldClass="long_description"
          maxChars={255}
          multiline
          required
          disabled={busy}
        />

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("label.game")}</span>
          {games.loading ? <ListSkeleton rows={3} /> : (
            <select className="input" value={gameId} onChange={(e) => setGameId(e.target.value ? Number(e.target.value) : "")} required>
              <option value="">{t("label.pick")}</option>
              {(games.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name} ({g.platform.toUpperCase()})</option>)}
            </select>
          )}
        </div>

        {/* Skill level — uses the SKILL_LEVELS constant from the API
            module so adding a new bracket on the backend (enum +
            migration) automatically extends the picker without a
            second edit here. */}
        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("tournament.skillLevel")}</span>
          <select
            className="input"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
          >
            {SKILL_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{t(`tournament.skillLevel.${lvl}`)}</option>
            ))}
          </select>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <PriceInput label={t("label.price")} value={price} onChange={setPrice} required />
          <Input label={t("label.participantsLimit")} type="number" min={0} value={participantsLimit} onChange={(e) => setParticipantsLimit(e.target.value)} />
        </div>

        <div className="row" style={{ gap: 10 }}>
          <Input label={t("label.startDate")} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Input label={t("label.endDate")} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {err && <div className="error">{err}</div>}
        {branch.error && <div className="error">{t("tournament.branchLoadFailed")}: {branch.error.message}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy || branch.loading}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};


export default TournamentForm;
