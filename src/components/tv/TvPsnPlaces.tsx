import { PSN_ONLINE_ID } from "@/api/psn";
import { apiListPsnPlaces, apiRemovePlacePsnAccount, apiSetPlacePsnAccount } from "@/api/psnPlaces";
import { useAuth } from "@/auth/AuthContext";
import PsnSenderCard from "@/components/ps5/PsnSenderCard";
import Button from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { IBranchPlace } from "@/types/api";
import { platformGroup } from "@/utils/platform";
import { useEffect, useState } from "react";

interface Props {
  branchId: number;
  places: IBranchPlace[];
  placeLabel: (p: IBranchPlace) => string;
  /** The dialog's only content (TVs off): say so when the server does not send. */
  standalone?: boolean;
}

/**
 * «PlayStation без Android-телевизора» (2026-11-23): for TVs that cannot draw
 * over the game, the player messages go to the console as PSN messages. The
 * owner connects the company's sender once and names, per PlayStation place,
 * the account its console is signed in with. A place with a working Android
 * TV keeps getting them on the TV. Shown only while the backend sends them.
 */
const TvPsnPlaces = ({ branchId, places, placeLabel, standalone = false }: Props) => {
  const { t } = useLang();
  const { user } = useAuth();
  const list = useAsync(() => apiListPsnPlaces(branchId), [branchId]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saved: Record<number, string> = {};
  for (const row of list.data?.data ?? []) saved[row.place_id] = row.online_id;

  useEffect(() => {
    if (list.data) setDrafts(Object.fromEntries(list.data.data.map((r) => [r.place_id, r.online_id])));
  }, [list.data]);

  if (!list.data?.enabled) {
    return standalone && list.data ? <div className="muted" data-testid="tv-psn-off">{t("tv.psn.off")}</div> : null;
  }
  const companyId = user?.dashboard?.company_id;
  const consoles = places.filter((p) => platformGroup(p.platform) === "ps");

  const save = async (placeId: number) => {
    const value = (drafts[placeId] ?? "").trim();
    setError(null);
    setBusy(placeId);
    try {
      if (value === "") await apiRemovePlacePsnAccount(placeId);
      else await apiSetPlacePsnAccount(placeId, value);
      await list.reload();
    } catch {
      setError(t("tv.error.generic"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="col" style={{ gap: 10 }} data-testid="tv-psn">
      {!standalone && <strong>{t("tv.psn.title")}</strong>}
      <div className="muted">{t("tv.psn.intro")}</div>
      {typeof companyId === "number" && <PsnSenderCard companyId={companyId} descriptionKey="psn.description.places" />}
      {error && <div className="error" role="alert">{error}</div>}
      {consoles.length === 0 ? (
        <div className="muted">{t("tv.psn.noConsoles")}</div>
      ) : (
        consoles.map((p) => {
          const draft = drafts[p.id] ?? "";
          const valid = draft.trim() === "" || PSN_ONLINE_ID.test(draft.trim());
          const changed = draft.trim() !== (saved[p.id] ?? "");
          return (
            <div key={p.id} className="row-between" style={{ gap: 10, flexWrap: "wrap" }} data-testid="tv-psn-row">
              <span>{placeLabel(p)}</span>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <input
                  className="input"
                  aria-label={t("tv.psn.account")}
                  placeholder={t("tv.psn.account")}
                  maxLength={16}
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                />
                <Button type="button" variant="secondary" disabled={!valid || !changed || busy !== null} onClick={() => void save(p.id)}>
                  {t("action.save")}
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default TvPsnPlaces;
