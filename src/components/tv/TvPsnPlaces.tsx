import { PSN_ONLINE_ID } from "@/api/psn";
import { apiListPsnPlaces, apiSetPlacePsnAccounts, MAX_PSN_ACCOUNTS_PER_PLACE, parseOnlineIds } from "@/api/psnPlaces";
import { useAuth } from "@/auth/AuthContext";
import PsnSenderCard from "@/components/ps5/PsnSenderCard";
import Button from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
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
  const [notice, setNotice] = useState<string | null>(null);

  const saved: Record<number, string> = {};
  for (const row of list.data?.data ?? []) saved[row.place_id] = row.online_ids.join(", ");

  useEffect(() => {
    if (list.data) setDrafts(Object.fromEntries(list.data.data.map((r) => [r.place_id, r.online_ids.join(", ")])));
  }, [list.data]);

  if (!list.data?.enabled) {
    return standalone && list.data ? <div className="muted" data-testid="tv-psn-off">{t("tv.psn.off")}</div> : null;
  }
  const companyId = user?.dashboard?.company_id;
  const consoles = places.filter((p) => platformGroup(p.platform) === "ps");

  const save = async (placeId: number) => {
    const ids = parseOnlineIds(drafts[placeId] ?? "");
    setError(null);
    setNotice(null);
    setBusy(placeId);
    try {
      const r = await apiSetPlacePsnAccounts(placeId, ids);
      if (!r.data.checked && ids.length > 0) setNotice(t("tv.psn.unchecked"));
      await list.reload();
    } catch (err) {
      const body = (err as { body?: { code?: string; unknown?: string[]; online_id?: string } } | null)?.body;
      if (body?.code === "psn_unknown_online_ids") setError(fmt(t("tv.psn.unknown"), (body.unknown ?? []).join(", ")));
      else if (body?.code === "psn_sender_is_console") setError(fmt(t("tv.psn.senderIsConsole"), body.online_id ?? ""));
      else setError(t("tv.error.generic"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="col" style={{ gap: 10 }} data-testid="tv-psn">
      {!standalone && <strong>{t("tv.psn.title")}</strong>}
      <div className="muted">{t("tv.psn.intro")}</div>
      {typeof companyId === "number" && <PsnSenderCard companyId={companyId} descriptionKey="psn.description.places" />}
      <div className="muted">{t("tv.psn.howMany")}</div>
      {error && <div className="error" role="alert">{error}</div>}
      {notice && <div className="muted" data-testid="tv-psn-notice">{notice}</div>}
      {consoles.length === 0 ? (
        <div className="muted">{t("tv.psn.noConsoles")}</div>
      ) : (
        consoles.map((p) => {
          const draft = drafts[p.id] ?? "";
          const ids = parseOnlineIds(draft);
          const valid = ids.length <= MAX_PSN_ACCOUNTS_PER_PLACE && ids.every((id) => PSN_ONLINE_ID.test(id));
          const changed = ids.join(", ") !== (saved[p.id] ?? "");
          return (
            <div key={p.id} className="row-between" style={{ gap: 10, flexWrap: "wrap" }} data-testid="tv-psn-row">
              <span>{placeLabel(p)}</span>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <input
                  className="input"
                  aria-label={t("tv.psn.account")}
                  placeholder={t("tv.psn.account")}
                  maxLength={160}
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
