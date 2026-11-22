import {
  apiListTvScreens,
  apiPairTvScreen,
  apiUnpairTvScreen,
  apiUpdateTvScreen,
  isTvCode,
  ITvScreen,
  normalizeTvCode,
} from "@/api/tvScreens";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { IBranchPlace } from "@/types/api";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  /** The branch's places, as the Places screen already has them. */
  places: IBranchPlace[];
  onClose: () => void;
}

const placeLabel = (p: { number?: number | null; name?: string | null; id: number }): string => {
  const num = `№${p.number ?? p.id}`;
  return p.name ? `${num} · ${p.name}` : num;
};

/**
 * The branch's TVs (2026-11-23): pair one by the code on its screen, move it
 * to another place, unpair it.
 *
 * Only server calls — no LAN, no bridge — so it works the same on the desktop
 * and in the owner web. It never touches consoles, computers or sessions.
 */
const TvScreensDialog = ({ branchId, places, onClose }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const screens = useAsync(() => apiListTvScreens(branchId), [branchId]);
  const [code, setCode] = useState("");
  const [placeId, setPlaceId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = normalizeTvCode(code);
  const canPair = isTvCode(cleanCode) && placeId !== "" && !busy;

  const failure = (e: unknown): string => {
    const body = (e as { body?: { code?: string } } | null)?.body;
    return body?.code === "tv_code_unknown" ? t("tv.error.code") : t("tv.error.generic");
  };

  const pair = async (e: FormEvent) => {
    e.preventDefault();
    if (!canPair) return;
    setBusy(true);
    setError(null);
    try {
      await apiPairTvScreen(branchId, { code: cleanCode, place_id: Number(placeId), name: name.trim() || null });
      setCode("");
      setName("");
      setPlaceId("");
      await screens.reload();
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  };

  const move = async (screen: ITvScreen, next: number) => {
    setError(null);
    try {
      await apiUpdateTvScreen(screen.id, { place_id: next });
      await screens.reload();
    } catch (err) {
      setError(failure(err));
    }
  };

  const unpair = async (screen: ITvScreen) => {
    if (!(await confirm(t("tv.unpair.confirm"), { destructive: true }))) return;
    setError(null);
    try {
      await apiUnpairTvScreen(screen.id);
      await screens.reload();
    } catch (err) {
      setError(failure(err));
    }
  };

  const list = screens.data ?? [];

  return (
    <Modal open onClose={onClose}>
      <div className="card tv-dialog" style={{ width: 600, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0 }}>{t("tv.title")}</h2>
        <div className="muted">{t("tv.intro")}</div>

        <form onSubmit={pair} className="col" style={{ gap: 10 }} data-testid="tv-pair-form">
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "0 0 140px" }}>
              <Input
                label={t("tv.code")}
                value={code}
                inputMode="numeric"
                autoComplete="off"
                maxLength={9}
                placeholder="000000"
                onChange={(e) => setCode(e.target.value)}
                data-testid="tv-code"
              />
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <span className="label">{t("tv.place")}</span>
              <select
                className="input"
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value === "" ? "" : Number(e.target.value))}
                data-testid="tv-place"
              >
                <option value="">{t("tv.place.choose")}</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>{placeLabel(p)}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <Input label={t("tv.name")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" disabled={!canPair} data-testid="tv-pair">{t("tv.pair")}</Button>
          </div>
        </form>

        {error && <div className="error" role="alert">{error}</div>}

        <div className="col" style={{ gap: 8 }} data-testid="tv-list">
          {screens.loading && !screens.data ? (
            <ListSkeleton rows={2} />
          ) : screens.error ? (
            <div className="row-between">
              <span className="error">{t("tv.error.load")}</span>
              <Button type="button" variant="secondary" onClick={() => void screens.reload()}>{t("action.retry")}</Button>
            </div>
          ) : list.length === 0 ? (
            <div className="muted">{t("tv.empty")}</div>
          ) : (
            list.map((s) => (
              <div key={s.id} className="row-between card" style={{ gap: 10, padding: 10, flexWrap: "wrap" }} data-testid="tv-row">
                <div className="col" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{s.name || t("tv.unnamed")}</strong>
                  <span className={s.online ? undefined : "muted"} style={s.online ? { color: "var(--color-success)" } : undefined}>{s.online ? t("tv.online") : t("tv.offline")}</span>
                </div>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <select
                    className="input"
                    aria-label={t("tv.place")}
                    value={s.place_id ?? ""}
                    onChange={(e) => e.target.value !== "" && void move(s, Number(e.target.value))}
                  >
                    {s.place_id === null && <option value="">{t("tv.place.none")}</option>}
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>{placeLabel(p)}</option>
                    ))}
                  </select>
                  <Button type="button" variant="secondary" onClick={() => void unpair(s)}>{t("tv.unpair")}</Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onClose}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default TvScreensDialog;
