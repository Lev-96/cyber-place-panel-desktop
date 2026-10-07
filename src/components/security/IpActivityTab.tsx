import {
  IIpActivityApi, IP_ACTIVITY_DEVICES, IP_ACTIVITY_OS, IP_ACTIVITY_SOURCES,
  IpActivityDevice, IpActivityOs, IpActivitySort, IpActivitySource, isKnownDevice, isKnownOs,
} from "@/api/ipActivity";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { securityRepository } from "@/repositories/SecurityRepository";
import { useEffect, useState } from "react";
import { countryName } from "./countryNames";
import DeviceIcon from "./DeviceIcon";

/** Typing pause before the server is asked again. */
const SEARCH_DEBOUNCE_MS = 400;
const PER_PAGE = 25;
const SORTS: readonly IpActivitySort[] = ["last_seen", "first_seen", "visits"];

/** A filter picked from a row: one user, or one city. */
type Pick = { kind: "user"; id: number; label: string } | { kind: "city"; label: string };

const isKnownSource = (value: string): value is IpActivitySource =>
  (IP_ACTIVITY_SOURCES as readonly string[]).includes(value);

/**
 * The addresses the Cyber Place server saw for connections to its own
 * services (2026-09-30): who, from which address, roughly where, through which
 * app, when first and last, how many visits.
 *
 * Everything is searched, filtered, sorted and paged by the server; the page
 * belongs to the query it was chosen for, so any change of search or filter
 * starts on page 1 without a second request, and a page is always replaced,
 * never appended to. Clicking a user or a city narrows the list to it.
 */
const IpActivityTab = () => {
  const { t, lang } = useLang();

  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [source, setSource] = useState<IpActivitySource | "">("");
  const [country, setCountry] = useState("");
  const [device, setDevice] = useState<IpActivityDevice | "">("");
  const [os, setOs] = useState<IpActivityOs | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<IpActivitySort>("last_seen");
  const [picks, setPicks] = useState<Pick[]>([]);

  const user = picks.find((p): p is Extract<Pick, { kind: "user" }> => p.kind === "user");
  const city = picks.find((p) => p.kind === "city");

  const key = JSON.stringify([query, source, country, device, os, from, to, sort, user?.id ?? null, city?.label ?? null]);
  // Anything narrowing the list: an empty answer then means "nothing matches",
  // not "nothing recorded". (Sort orders, it does not narrow.)
  const narrowed = Boolean(query || source || country || device || os || from || to || picks.length > 0);
  const [paging, setPaging] = useState({ key, page: 1 });
  const page = paging.key === key ? paging.page : 1;

  const { data, loading, error, reload } = useAsync(
    () => securityRepository.ipActivity({
      search: query || undefined,
      source: source || undefined,
      country: country || undefined,
      device: device || undefined,
      os: os || undefined,
      city: city?.label,
      user_id: user?.id,
      from: from || undefined,
      to: to || undefined,
      sort,
      dir: "desc",
      page,
      per_page: PER_PAGE,
    }),
    [key, page],
  );

  const rows = data?.data ?? [];
  const lastPage = data?.meta?.last_page ?? 1;
  const countries = Object.keys(data?.countries ?? {});

  // The page a refresh left behind no longer exists: step back to the last one.
  useEffect(() => {
    if (!loading && page > lastPage) setPaging({ key, page: lastPage });
  }, [loading, page, lastPage, key]);

  const pick = (next: Pick) => setPicks((current) => [...current.filter((p) => p.kind !== next.kind), next]);
  const unpick = (kind: Pick["kind"]) => setPicks((current) => current.filter((p) => p.kind !== kind));

  const sourceLabel = (value: string) => (isKnownSource(value) ? t(`ipActivity.source.${value}`) : value);
  // "iOS 17.8", "Windows", "Android 15"; a name this build does not know is
  // shown as sent; nothing known → "Unknown" (also every row of an older
  // backend, which sends neither field).
  const osText = (r: IIpActivityApi) => {
    if (!r.os_name) return t("ipActivity.unknown");
    const name = isKnownOs(r.os_name) ? t(`ipActivity.os.${r.os_name}`) : r.os_name;
    return r.os_version ? `${name} ${r.os_version}` : name;
  };
  const countryText = (r: IIpActivityApi) =>
    r.country_code ? countryName(r.country_code, lang) : t("ipActivity.unknown");

  return (
    <div className="col sec-stack">
      <p className="muted sec-hint">{t("ipActivity.about")}</p>

      <div className="card sec-form ipa-filters">
        <div className="sec-form__fields">
          <label className="sec-field sec-field--grow">
            <span className="label">{t("ipActivity.search")}</span>
            <input
              className="input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("ipActivity.searchHint")}
              maxLength={255}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="sec-field">
            <span className="label">{t("ipActivity.col.source")}</span>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value as IpActivitySource | "")}>
              <option value="">{t("ipActivity.all")}</option>
              {IP_ACTIVITY_SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
            </select>
          </label>
          <label className="sec-field">
            <span className="label">{t("ipActivity.col.country")}</span>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t("ipActivity.all")}</option>
              {country && !countries.includes(country) && <option value={country}>{countryName(country, lang)}</option>}
              {countries.map((code) => <option key={code} value={code}>{countryName(code, lang)}</option>)}
            </select>
          </label>
        </div>
        <div className="sec-form__fields">
          <label className="sec-field">
            <span className="label">{t("ipActivity.col.device")}</span>
            <select className="input" value={device} onChange={(e) => setDevice(e.target.value as IpActivityDevice | "")}>
              <option value="">{t("ipActivity.all")}</option>
              {IP_ACTIVITY_DEVICES.map((d) => <option key={d} value={d}>{t(`ipActivity.device.${d}`)}</option>)}
            </select>
          </label>
          <label className="sec-field">
            <span className="label">{t("ipActivity.col.os")}</span>
            <select className="input" value={os} onChange={(e) => setOs(e.target.value as IpActivityOs | "")}>
              <option value="">{t("ipActivity.all")}</option>
              {IP_ACTIVITY_OS.map((o) => <option key={o} value={o}>{t(`ipActivity.os.${o}`)}</option>)}
            </select>
          </label>
        </div>
        <div className="sec-form__fields">
          <label className="sec-field">
            <span className="label">{t("ipActivity.from")}</span>
            <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="sec-field">
            <span className="label">{t("ipActivity.to")}</span>
            <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="sec-field">
            <span className="label">{t("ipActivity.sort")}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as IpActivitySort)}>
              {SORTS.map((s) => <option key={s} value={s}>{t(`ipActivity.sort.${s}`)}</option>)}
            </select>
          </label>
        </div>
        {picks.length > 0 && (
          <div className="ipa-picks">
            {picks.map((p) => (
              <button key={p.kind} type="button" className="ipa-pick" onClick={() => unpick(p.kind)} aria-label={`${t("ipActivity.clearFilter")}: ${p.label}`}>
                {p.label} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <StateSwitch
        view={deriveViewState({ loading, error, data: data ? rows : null, hasFilters: narrowed })}
        skeleton={<ListSkeleton rows={6} />}
        size="section"
        onRetry={() => void reload()}
        error={{ titleKey: "ipActivity.state.errorTitle" }}
        empty={{ titleKey: "ipActivity.state.emptyTitle", descriptionKey: "ipActivity.state.emptyDescription" }}
        noResults={{ titleKey: "ipActivity.empty", descriptionKey: "state.noResults.description" }}
      >
        <div className="sec-table-wrap" aria-busy={loading || undefined}>
          <table className="sec-table ipa-table">
            <thead>
              <tr>
                <th scope="col">{t("ipActivity.col.user")}</th>
                <th scope="col">{t("ipActivity.col.device")}</th>
                <th scope="col">{t("ipActivity.col.os")}</th>
                <th scope="col">{t("ipActivity.col.ip")}</th>
                <th scope="col">{t("ipActivity.col.country")}</th>
                <th scope="col">{t("ipActivity.col.city")}</th>
                <th scope="col">{t("ipActivity.col.source")}</th>
                <th scope="col">{t("ipActivity.col.firstSeen")}</th>
                <th scope="col">{t("ipActivity.col.lastSeen")}</th>
                <th scope="col" className="ipa-num">{t("ipActivity.col.visits")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label={t("ipActivity.col.user")}>
                    <Who row={r} onPickUser={(id, label) => pick({ kind: "user", id, label })} />
                  </td>
                  <td data-label={t("ipActivity.col.device")}><DeviceCell device={r.device} /></td>
                  <td data-label={t("ipActivity.col.os")}>{osText(r)}</td>
                  <td data-label={t("ipActivity.col.ip")} className="sec-num">{r.ip_address}</td>
                  <td data-label={t("ipActivity.col.country")}>{countryText(r)}</td>
                  <td data-label={t("ipActivity.col.city")}>
                    {r.city_name ? (
                      <button type="button" className="ipa-link" onClick={() => pick({ kind: "city", label: r.city_name! })}>
                        {r.city_name}
                      </button>
                    ) : t("ipActivity.unknown")}
                  </td>
                  <td data-label={t("ipActivity.col.source")}>
                    <span className={`pill ipa-source is-${r.source}`}>{sourceLabel(r.source)}</span>
                  </td>
                  <td data-label={t("ipActivity.col.firstSeen")}>{formatDateTime(r.first_seen_at)}</td>
                  <td data-label={t("ipActivity.col.lastSeen")}>{formatDateTime(r.last_seen_at)}</td>
                  <td data-label={t("ipActivity.col.visits")} className="ipa-num">{r.visits_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateSwitch>
      {(data || !error) && (
        <Pagination page={page} lastPage={lastPage} onChange={(p) => setPaging({ key, page: p })} disabled={loading} />
      )}
    </div>
  );
};

/** The device, as an icon and its name; "Unknown" when the backend could not tell. */
const DeviceCell = ({ device }: { device: string | null | undefined }) => {
  const { t } = useLang();
  if (!device) return <span className="muted">{t("ipActivity.unknown")}</span>;
  if (!isKnownDevice(device)) return <span>{device}</span>;
  return (
    <span className="ipa-device">
      <DeviceIcon device={device} />
      <span>{t(`ipActivity.device.${device}`)}</span>
    </span>
  );
};

/** The account a row is about: a staff member, a mobile player, or nobody signed in. */
const Who = ({ row, onPickUser }: { row: IIpActivityApi; onPickUser: (id: number, label: string) => void }) => {
  const { t } = useLang();
  if (row.user) {
    return (
      <div className="ipa-who">
        <button type="button" className="ipa-link" onClick={() => onPickUser(row.user!.id, row.user!.name)} title={t("ipActivity.onlyThisUser")}>
          {row.user.name}
        </button>
        <span className="meta">{row.user.email}</span>
      </div>
    );
  }
  if (row.guest) {
    return (
      <div className="ipa-who">
        <span>{row.guest.name ?? t("ipActivity.player")}</span>
        <span className="meta">{t("ipActivity.player")} #{row.guest.id}</span>
      </div>
    );
  }
  return <span className="muted">{row.source === "telegram_bot" ? t("ipActivity.telegramServers") : t("ipActivity.anonymous")}</span>;
};

export default IpActivityTab;
