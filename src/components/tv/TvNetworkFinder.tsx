import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { discoverTvs, FoundTv } from "@/tv/tvDiscovery";
import { IBranchPlace } from "@/types/api";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  places: IBranchPlace[];
  placeLabel: (p: IBranchPlace) => string;
  /** The same server call the code form makes; throws on refusal. */
  onPair: (code: string, placeId: number, name: string | null) => Promise<void>;
}

/** What the owner sees for a TV: "Sony BRAVIA 4K", or its address. */
const tvTitle = (tv: FoundTv): string => `${tv.maker} ${tv.model}`.trim() || tv.address;

/**
 * «Телевизоры в сети» (2026-11-23): the desktop asks the club network which
 * Cyber Place TVs are waiting for a place and lists them; the owner picks a
 * place and presses «Привязать». No code to type: the TV's answer carries it.
 * Desktop only — the dialog renders this when the bridge exists.
 */
const TvNetworkFinder = ({ places, placeLabel, onPair }: Props) => {
  const { t } = useLang();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<FoundTv[] | null>(null);
  const [otherEnv, setOtherEnv] = useState(0);
  const [chosen, setChosen] = useState<Record<string, number | "">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    const result = await discoverTvs();
    if (!alive.current) return;
    setFound(result.matching);
    setOtherEnv(result.otherEnv);
    setScanning(false);
  }, []);

  useEffect(() => { void scan(); }, [scan]);

  const pair = async (tv: FoundTv) => {
    const placeId = chosen[tv.address];
    if (placeId === "" || placeId === undefined) return;
    setBusy(tv.address);
    try {
      await onPair(tv.code, placeId, tvTitle(tv) === tv.address ? null : tvTitle(tv).slice(0, 60));
      // Paired: it stops answering within a poll; drop it here at once.
      if (alive.current) setFound((list) => (list ?? []).filter((x) => x.address !== tv.address));
    } catch {
      // The dialog shows the reason; the TV stays in the list to try again.
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  return (
    <div className="col" style={{ gap: 8 }} data-testid="tv-network">
      <div className="row-between" style={{ gap: 10 }}>
        <strong>{t("tv.network.title")}</strong>
        <Button type="button" variant="secondary" disabled={scanning} onClick={() => void scan()} data-testid="tv-scan">
          {scanning ? t("tv.network.scanning") : t("tv.network.scan")}
        </Button>
      </div>
      {found !== null && !scanning && found.length === 0 && (
        <div className="muted" data-testid="tv-network-empty">{t("tv.network.none")}</div>
      )}
      {otherEnv > 0 && !scanning && (
        <div className="muted" data-testid="tv-network-other">{fmt(t("tv.network.otherEnv"), otherEnv)}</div>
      )}
      {(found ?? []).map((tv) => (
        <div key={tv.address} className="row-between card" style={{ gap: 10, padding: 10, flexWrap: "wrap" }} data-testid="tv-found">
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <strong>{tvTitle(tv)}</strong>
            <span className="muted">{tv.address}</span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <select
              className="input"
              aria-label={t("tv.place")}
              value={chosen[tv.address] ?? ""}
              onChange={(e) => setChosen((c) => ({ ...c, [tv.address]: e.target.value === "" ? "" : Number(e.target.value) }))}
            >
              <option value="">{t("tv.place.choose")}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>{placeLabel(p)}</option>
              ))}
            </select>
            <Button
              type="button"
              disabled={busy !== null || chosen[tv.address] === undefined || chosen[tv.address] === ""}
              onClick={() => void pair(tv)}
            >
              {t("tv.pair")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TvNetworkFinder;
