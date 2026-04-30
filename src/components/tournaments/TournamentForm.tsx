import Button from "@/components/ui/Button";
import { formatApiError } from "@/api/errors";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { ITournamentApi } from "@/api/tournaments";
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
  const { t } = useLang();
  const games = useAsync(() => gameRepository.list(), []);
  const branch = useAsync(() => branchRepository.byId(branchId), [branchId]);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [gameId, setGameId] = useState<number | "">(initial?.game_id ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? "0"));
  const [participantsLimit, setParticipantsLimit] = useState(String(initial?.participants_limit ?? ""));
  const [startDate, setStartDate] = useState(initial?.start_date?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!gameId) return setErr(t("tournament.errors.pickGame"));
    if (!description.trim()) return setErr(t("tournament.errors.descRequired"));
    if (!startDate) return setErr(t("tournament.errors.startRequired"));

    const companyId = branch.data?.company_id;
    if (!companyId) return setErr(t("tournament.errors.companyMissing"));

    setBusy(true); setErr(null);
    try {
      if (initial) {
        await tournamentRepository.update(initial.id, {
          game_id: Number(gameId),
          title,
          description,
          price: Number(price) || 0,
          participants_limit: participantsLimit ? Number(participantsLimit) : undefined,
          start_date: startDate,
          end_date: endDate || undefined,
        });
      } else {
        await tournamentRepository.create({
          branch_id: branchId,
          company_id: companyId,
          game_id: Number(gameId),
          title,
          description,
          price: Number(price) || 0,
          participants_limit: participantsLimit ? Number(participantsLimit) : undefined,
          start_date: startDate,
          end_date: endDate || undefined,
        });
      }
      onSaved();
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 540, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("tournament.titleEdit") : t("tournament.titleNew")}</h2>
        <Input label={t("label.title")} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} autoFocus />
        <Input label={t("label.description")} value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={255} />

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("label.game")}</span>
          {games.loading ? <Spinner /> : (
            <select className="input" value={gameId} onChange={(e) => setGameId(e.target.value ? Number(e.target.value) : "")} required>
              <option value="">{t("label.pick")}</option>
              {(games.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name} ({g.platform.toUpperCase()})</option>)}
            </select>
          )}
        </div>

        <div className="row" style={{ gap: 10 }}>
          <Input label={t("label.price")} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
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
