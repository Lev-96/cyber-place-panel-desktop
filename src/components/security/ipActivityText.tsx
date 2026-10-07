import {
  IIpActivityApi, IP_ACTIVITY_SOURCES, IpActivitySource, isKnownBrowser, isKnownDevice, isKnownOs,
} from "@/api/ipActivity";
import { useLang } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { countryName } from "./countryNames";
import DeviceIcon from "./DeviceIcon";

/**
 * How one IP-activity row reads, shared by the table and the details dialog so
 * the two can never word the same value differently. Every helper takes the
 * render-time `t`, so a language switch re-words everything.
 */

type T = (key: string) => string;

export const isKnownSource = (value: string): value is IpActivitySource =>
  (IP_ACTIVITY_SOURCES as readonly string[]).includes(value);

export const sourceLabel = (t: T, value: string): string =>
  (isKnownSource(value) ? t(`ipActivity.source.${value}`) : value);

/** "Name version" for a known name, the value as sent for an unknown one. */
const withVersion = (name: string, version: string | null | undefined): string =>
  (version ? `${name} ${version}` : name);

/** "iOS 17.8", "Windows"; nothing known → "Unknown" (also every row of an older backend). */
export const osText = (t: T, r: IIpActivityApi): string => {
  if (!r.os_name) return t("ipActivity.unknown");
  return withVersion(isKnownOs(r.os_name) ? t(`ipActivity.os.${r.os_name}`) : r.os_name, r.os_version);
};

/** "Chrome 129", "Cyber Place app"; nothing known → "Not determined". */
export const browserText = (t: T, r: IIpActivityApi): string => {
  if (!r.browser) return t("ipActivity.notDetermined");
  return withVersion(isKnownBrowser(r.browser) ? t(`ipActivity.browser.${r.browser}`) : r.browser, r.browser_version);
};

export const countryText = (t: T, lang: Lang, r: IIpActivityApi): string =>
  (r.country_code ? countryName(r.country_code, lang) : t("ipActivity.unknown"));

/** "AS15169", or null when the backend sent no number. */
export const asLabel = (asn: number | null | undefined): string | null =>
  (typeof asn === "number" ? `AS${asn}` : null);

/** The label of a staff role; a role this build has no word for reads as sent. */
export const roleLabel = (t: T, role: string): string => {
  const key = `role.${role}`;
  const label = t(key);
  return label === key ? role : label;
};

/** The device, as an icon and its name; "Unknown" when the backend could not tell. */
export const DeviceCell = ({ device }: { device: string | null | undefined }) => {
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
