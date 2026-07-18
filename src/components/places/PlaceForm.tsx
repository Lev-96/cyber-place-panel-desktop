import Button from "@/components/ui/Button";
import { formatApiError } from "@/api/errors";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import PlatformPicker from "@/components/ui/PlatformPicker";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { gameRepository } from "@/repositories/GameRepository";
import { placeRepository } from "@/repositories/PlaceRepository";
import { IBranchPlace, PlaceType } from "@/types/api";
import { isKnownPlatform, platformLabel } from "@/utils/platform";
import { FormEvent, useEffect, useState } from "react";

interface Props {
  branchId: number;
  initial?: IBranchPlace;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: PlaceType[] = ["standard", "vip"];

const PlaceForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const games = useAsync(() => gameRepository.list(), []);
  const [number, setNumber] = useState(initial ? String(initial.number ?? "") : "");
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<PlaceType>(initial?.type ?? "standard");
  const [platform, setPlatform] = useState<string>(initial?.platform ?? "pc");
  const [hourlyRate, setHourlyRate] = useState(initial?.hourly_rate != null ? String(initial.hourly_rate) : "");
  const [gameIds, setGameIds] = useState<Set<number>>(new Set((initial?.games ?? []).map((g) => g.id)));

  // A custom (non-pc/ps4/ps5) platform has no cell in the branch tariff
  // matrix, so it carries its own per-hour price entered right here.
  const isCustomPlatform = !isKnownPlatform(platform);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-suggest next available number on create
  useEffect(() => {
    if (initial || number) return;
    void placeRepository.nextNumber(branchId).then((n) => setNumber(String(n))).catch(() => {});
  }, [branchId, initial, number]);

  const toggleGame = (id: number) => {
    const next = new Set(gameIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setGameIds(next);
  };

  const filteredGames = (games.data ?? []).filter((g) => g.platform === platform);

  // A place targets ONE platform, so its games must all belong to that
  // platform. When the operator switches platform (e.g. pc → ps4), drop any
  // games that were picked for the previous platform — otherwise a place
  // could be saved carrying games from a platform it no longer is. We wait
  // for the catalogue to load before pruning so an edit's initial games
  // (which already match the saved platform) are never cleared prematurely.
  useEffect(() => {
    if (!games.data) return;
    const validForPlatform = new Set(
      games.data.filter((g) => g.platform === platform).map((g) => g.id),
    );
    setGameIds((prev) => {
      const next = new Set([...prev].filter((gid) => validForPlatform.has(gid)));
      return next.size === prev.size ? prev : next;
    });
  }, [platform, games.data]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const num = Number(number);
    if (!Number.isFinite(num) || num <= 0) return setErr(t("place.errors.number"));
    setBusy(true); setErr(null);
    try {
      const body = {
        branch_id: branchId,
        number: num,
        name: name.trim() || null,
        type,
        platform,
        // Only custom platforms carry a manual rate; known ones bill from the matrix.
        hourly_rate: isCustomPlatform ? (hourlyRate ? Number(hourlyRate) : null) : null,
        game_ids: Array.from(gameIds),
      };
      if (initial) await placeRepository.update(initial.id, body);
      else await placeRepository.create(body);
      onSaved();
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 540, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? `${t("place.titleEdit")} №${initial.number ?? initial.id}` : t("place.titleNew")}</h2>

        <div className="row" style={{ gap: 10 }}>
          <Input label={t("label.number")} type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} required />
          <div className="col" style={{ gap: 6, flex: 1 }}>
            <span className="label">{t("label.type")}</span>
            <div className="row" style={{ gap: 6 }}>
              {TYPES.map((tp) => (
                <Button key={tp} type="button" variant={type === tp ? "primary" : "secondary"} onClick={() => setType(tp)} style={{ flex: 1 }}>{tp.toUpperCase()}</Button>
              ))}
            </div>
          </div>
        </div>

        <Input
          label={t("place.name")}
          placeholder={t("place.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("label.platform")}</span>
          <PlatformPicker value={platform} onChange={setPlatform} />
        </div>

        {isCustomPlatform && (
          <div className="col" style={{ gap: 6 }}>
            <Input
              label={t("place.hourlyRate")}
              type="number"
              min={0}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
            <span className="muted" style={{ fontSize: 11 }}>{t("place.customPlatformNote")}</span>
          </div>
        )}

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("place.gamesAvailable")} ({platformLabel(platform)})</span>
          {games.loading ? <Spinner /> : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 220, overflowY: "auto", padding: 6, border: "1px solid #1f2a44", borderRadius: 8 }}>
              {filteredGames.map((g) => (
                <Checkbox
                  key={g.id}
                  checked={gameIds.has(g.id)}
                  onChange={() => toggleGame(g.id)}
                  label={g.name}
                  style={{ padding: "4px 6px", borderRadius: 4, background: gameIds.has(g.id) ? "#101a35" : "transparent" }}
                />
              ))}
              {!filteredGames.length && <span className="muted">{t("place.noGamesPlatform")} {platformLabel(platform)}.</span>}
            </div>
          )}
          <span className="muted" style={{ fontSize: 11 }}>{gameIds.size} {t("place.selected")}</span>
        </div>

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};


export default PlaceForm;
