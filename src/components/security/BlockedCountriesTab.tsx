import { validationMessageOf } from "@/api/security";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import SuggestInput from "@/components/ui/SuggestInput";
import { useSecurityRefresh } from "@/components/security/securityRefresh";
import { useAsync } from "@/hooks/useAsync";
import { useKeyedBusy } from "@/hooks/useKeyedBusy";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { securityRepository } from "@/repositories/SecurityRepository";
import { FormEvent, useMemo, useState } from "react";
import { countryLabel, countryName } from "./countryNames";
import { compareText } from "@/i18n/collation";

const NOTE_MAX = 255;

/**
 * The code a typed or picked value stands for, among the codes the server
 * accepts: a picked label ("Armenia (AM)"), a bare code ("am"), or a name
 * typed in full. Null when it names nothing — or more than one thing.
 */
export const resolveCountryCode = (
  value: string,
  options: ReadonlyArray<{ code: string; label: string; name: string }>,
): string | null => {
  const q = value.trim().toLowerCase();
  if (!q) return null;
  const hit = options.filter((o) => o.label.toLowerCase() === q || o.code.toLowerCase() === q || o.name.toLowerCase() === q);
  return hit.length === 1 ? hit[0].code : null;
};

/**
 * Blocked countries. The server names the codes it accepts (`codes`) and the
 * caller's own country; the panel names them in the reading language through
 * `Intl.DisplayNames`. When the GeoIP database is missing the backend FAILS
 * OPEN — rules are stored and nothing is blocked — and the banner says so
 * before anybody trusts a list that is not being enforced.
 */
const BlockedCountriesTab = () => {
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const { begin, end, isBusy } = useKeyedBusy();
  const { data, loading, error, reload } = useAsync(() => securityRepository.blockedCountries(), []);
  useSecurityRefresh(reload);

  const [picked, setPicked] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const rows = useMemo(() => data?.data ?? [], [data]);
  const options = useMemo(() => {
    const blocked = new Set(rows.map((r) => r.country_code.toUpperCase()));
    return (data?.codes ?? [])
      .filter((code) => !blocked.has(code.toUpperCase()))
      .map((code) => ({ code, label: countryLabel(code, lang), name: countryName(code, lang) }))
      .sort((a, b) => compareText(a.name, b.name, lang));
  }, [data, rows, lang]);
  const labels = useMemo(() => options.map((o) => o.label), [options]);
  const code = resolveCountryCode(picked, options);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code || saving) return;
    setSaving(true);
    setFieldError(null);
    try {
      await securityRepository.blockCountry({ country_code: code, note: note.trim() || undefined });
      setPicked("");
      setNote("");
      void reload();
    } catch (err) {
      setFieldError(validationMessageOf(err, "country_code") ?? t("toast.fail.created"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number, countryCode: string) => {
    const ok = await confirm(fmt(t("security.countries.confirmDelete"), countryLabel(countryCode, lang)), {
      confirmLabel: t("security.countries.unblock"),
      destructive: true,
    });
    if (!ok || !begin(id)) return;
    try {
      await securityRepository.unblockCountry(id);
    } catch {
      // The toast said it failed; the re-read shows what is true.
    } finally {
      end(id);
    }
    void reload();
  };

  return (
    <div className="col sec-stack">
      {data && !data.geoip.available && (
        <div className="card state-notice" role="alert">{t("security.countries.geoipMissing")}</div>
      )}

      <form className="card sec-form" onSubmit={(e) => void submit(e)} noValidate>
        <div className="sec-form__fields">
          <div className="sec-field sec-field--grow">
            <SuggestInput
              label={t("security.countries.country")}
              value={picked}
              onValueChange={(v) => { setPicked(v); setFieldError(null); }}
              options={labels}
              placeholder={t("security.countries.search")}
              aria-label={t("security.countries.country")}
              aria-invalid={fieldError ? true : undefined}
            />
          </div>
          <label className="sec-field sec-field--grow">
            <span className="label">{t("security.note")}</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
          </label>
          <Button type="submit" className="sec-form__submit" disabled={saving || !code}>
            {t("security.countries.block")}
          </Button>
        </div>
        {fieldError && <div className="error" role="alert">{fieldError}</div>}
        {data && (
          <div className="muted sec-hint">
            {t("security.yourCountry")} {data.your_country ? countryLabel(data.your_country, lang) : t("security.countries.unknown")}
          </div>
        )}
      </form>

      <StateSwitch
        view={deriveViewState({ loading, error, data: data ? rows : null })}
        skeleton={<ListSkeleton rows={4} />}
        size="section"
        onRetry={() => void reload()}
        error={{ titleKey: "security.state.errorTitle" }}
        empty={{ titleKey: "security.countries.state.emptyTitle", descriptionKey: "security.countries.state.emptyDescription" }}
      >
        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                <th scope="col">{t("security.countries.country")}</th>
                <th scope="col">{t("security.note")}</th>
                <th scope="col">{t("security.col.addedBy")}</th>
                <th scope="col">{t("security.col.created")}</th>
                <th scope="col"><span className="sec-sr-only">{t("security.col.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label={t("security.countries.country")}>{countryLabel(r.country_code, lang)}</td>
                  <td data-label={t("security.note")} className="sec-wrap">{r.note || "-"}</td>
                  <td data-label={t("security.col.addedBy")}>{r.created_by?.name ?? "-"}</td>
                  <td data-label={t("security.col.created")}>{formatDateTime(r.created_at)}</td>
                  <td data-label={t("security.col.actions")}>
                    <Button
                      type="button"
                      variant="secondary"
                      className="sec-btn is-danger"
                      disabled={isBusy(r.id)}
                      onClick={() => void remove(r.id, r.country_code)}
                    >
                      {t("security.countries.unblock")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateSwitch>
    </div>
  );
};

export default BlockedCountriesTab;
