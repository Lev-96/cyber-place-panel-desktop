import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/state";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  apiConnectPsnSender,
  apiDisconnectPsnSender,
  apiGetPsnSender,
  npssoOf,
  PSN_NPSSO_URL,
  PSN_SIGN_IN_URL,
} from "@/api/psn";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { useState } from "react";

/**
 * The account PlayStation players are messaged from (2026-10-12): "your
 * session ends in 15 minutes" as a PSN message on the player's screen.
 *
 * The owner signs in to PlayStation in their own browser and pastes what
 * Sony's cookie page shows; the server exchanges it for a sign-in that lasts
 * about two months. The pasted value is a password in all but name: a
 * password field, sent once, never kept here.
 */
const PsnSenderCard = ({ companyId }: { companyId: number }) => {
  const { t } = useLang();
  const sender = useAsync(() => apiGetPsnSender(companyId).then((r) => r.data), [companyId]);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const npsso = npssoOf(pasted);
  const data = sender.data;

  const run = async (action: () => Promise<{ data: NonNullable<typeof data> }>) => {
    setBusy(true);
    setErr(null);
    try {
      const next = (await action()).data;
      sender.mutate(() => next);
      setPasted("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("action.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gradient-card" data-testid="psn-sender-card"><div className="gradient-card-inner">
      <h3 style={{ margin: 0 }}>{t("psn.title")}</h3>
      <span className="muted" style={{ fontSize: 12 }}>{t("psn.description")}</span>

      {sender.loading && !data ? <ListSkeleton rows={2} /> : sender.error && !data ? (
        <ErrorState size="compact" error={sender.error} onRetry={() => void sender.reload()} titleKey="psn.loadFailed" descriptionKey={null} />
      ) : (
        <>
          {data?.connected ? (
            <div className="col" style={{ gap: 4 }}>
              <div className="kv-row">
                <span className="k">{t("psn.account")}</span>
                <span className="v">{data.online_id ?? t("psn.connected")}</span>
              </div>
              {data.expires_at && (
                <div className="kv-row"><span className="k">{t("psn.validUntil")}</span><span className="v">{formatDate(data.expires_at)}</span></div>
              )}
              {data.last_sent_at && (
                <div className="kv-row"><span className="k">{t("psn.lastSent")}</span><span className="v">{formatDateTime(data.last_sent_at)}</span></div>
              )}
              {data.last_error && (
                <div className="error" style={{ fontSize: 12 }}>
                  {t(`psn.error.${data.last_error}`)}
                  {data.last_error_detail && (
                    <div className="muted mono" style={{ fontSize: 11 }} data-testid="psn-error-detail">{data.last_error_detail}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="muted">{t("psn.notConnected")}</span>
          )}

          <ol className="col" style={{ gap: 6, margin: 0, paddingLeft: 18, fontSize: 13 }}>
            <li>
              {t("psn.step1")}{" "}
              <Button type="button" variant="secondary" onClick={() => window.open(PSN_SIGN_IN_URL, "_blank")}>{t("psn.openSignIn")}</Button>
            </li>
            <li>
              {t("psn.step2")}{" "}
              <Button type="button" variant="secondary" onClick={() => window.open(PSN_NPSSO_URL, "_blank")}>{t("psn.openCode")}</Button>
            </li>
            <li>{t("psn.step3")}</li>
          </ol>
          <Input
            type="password"
            label={t("psn.pasteLabel")}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            data-testid="psn-npsso"
          />
          {pasted.trim() !== "" && !npsso && <div className="error" style={{ fontSize: 12 }}>{t("psn.pasteInvalid")}</div>}
          {err && <div className="error">{err}</div>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button type="button" disabled={busy || !npsso} onClick={() => npsso && void run(() => apiConnectPsnSender(companyId, npsso))}>
              {busy ? "…" : t(data?.connected ? "psn.reconnect" : "psn.connect")}
            </Button>
            {data?.connected && (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(() => apiDisconnectPsnSender(companyId))}>
                {t("psn.disconnect")}
              </Button>
            )}
          </div>
        </>
      )}
    </div></div>
  );
};

export default PsnSenderCard;
