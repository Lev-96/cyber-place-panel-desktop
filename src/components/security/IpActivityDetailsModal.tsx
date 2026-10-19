import { IIpActivityApi, IIpActivityLocation } from "@/api/ipActivity";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StateSwitch, StateView, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { securityRepository } from "@/repositories/SecurityRepository";
import { ReactNode, Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  DeviceCell, asLabel, browserText, countryText, osText, roleLabel, sourceLabel,
} from "./ipActivityText";

/**
 * Leaflet is ~150 kB: it loads when a dialog actually has a place to show,
 * never with the Security screen itself. Same chunk the branch screens use.
 */
const BranchMap = lazy(() => import("@/components/map/BranchMap"));

const MAP_HEIGHT = 280;
/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;

interface Props {
  /** The row to read; the dialog fetches it itself (the server audits the read). */
  id: number;
  onClose: () => void;
}

/**
 * One IP-activity row in full (2026-10-07): who, through what, from which
 * network, roughly where, and when. Read from `GET /admin/ip-activity/{id}`
 * rather than handed the list row, because opening it is an audited access.
 * Shows what the resource carries and nothing else: no token, header or body
 * ever reaches the panel.
 */
const IpActivityDetailsModal = ({ id, onClose }: Props) => {
  const { data, loading, error, reload } = useAsync(
    () => securityRepository.ipActivityDetails(id),
    [id],
    { revalidateOnCacheChange: false },
  );
  // An answer for another row (the id changed while a read was out) is not this one.
  const row = data && data.id === id ? data : null;

  return (
    <Modal open onClose={onClose}>
      <div className="card ipa-details">
        <StateSwitch
          view={deriveViewState({ loading, error, data: row, isEmpty: () => false })}
          skeleton={<DetailsSkeleton />}
          size="compact"
          onRetry={() => void reload()}
          error={{
            titleKey: "ipActivity.details.errorTitle",
            notFoundTitleKey: "ipActivity.details.notFoundTitle",
            notFoundDescriptionKey: "ipActivity.details.notFoundDescription",
          }}
        >
          {row && <Details row={row} />}
        </StateSwitch>
      </div>
    </Modal>
  );
};

const DetailsSkeleton = () => (
  <div className="ipa-details__body" aria-busy="true">
    <div className="ipa-details__facts">
      <Skeleton width="60%" height={28} />
      {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={14} />)}
    </div>
    <div className="ipa-details__place">
      <Skeleton height={MAP_HEIGHT} radius={12} />
    </div>
  </div>
);

const Details = ({ row }: { row: IIpActivityApi }) => {
  const { t, lang } = useLang();
  const as = asLabel(row.asn);
  return (
    <>
      <header className="ipa-details__head">
        <div className="ipa-details__title">
          <h2 className="ipa-details__ip sec-num">{row.ip_address}</h2>
          <span className={`pill ipa-source is-${row.source}`}>{sourceLabel(t, row.source)}</span>
          <CopyButton text={row.ip_address} />
        </div>
        <Who row={row} />
      </header>

      <div className="ipa-details__body">
        <div className="ipa-details__facts">
          <FactGroup title={t("ipActivity.group.device")}>
            <Fact label={t("ipActivity.col.device")}><DeviceCell device={row.device} /></Fact>
            <Fact label={t("ipActivity.col.os")}>{osText(t, row)}</Fact>
            <Fact label={t("ipActivity.col.browser")}>{browserText(t, row)}</Fact>
          </FactGroup>
          {/* The place and the network are two separate facts read from two
              separate databases (MaxMind City / ASN): the country and city come
              from the IP address itself, never from the provider. Kept in
              their own groups so neither reads as derived from the other. */}
          <FactGroup title={t("ipActivity.group.place")}>
            <Fact label={t("ipActivity.col.country")}>{countryText(t, lang, row)}</Fact>
            <Fact label={t("ipActivity.col.region")}>{row.region_name || <span className="muted">{t("ipActivity.notDetermined")}</span>}</Fact>
            <Fact label={t("ipActivity.col.city")}>{row.city_name || <span className="muted">{t("ipActivity.notDetermined")}</span>}</Fact>
          </FactGroup>
          <FactGroup title={t("ipActivity.col.network")}>
            <Fact label={t("ipActivity.details.organization")}>
              {row.as_org || <span className="muted">{t("ipActivity.notDetermined")}</span>}
            </Fact>
            <Fact label={t("ipActivity.details.asNumber")}>
              {as ? <span className="sec-num">{as}</span> : <span className="muted">{t("ipActivity.notDetermined")}</span>}
            </Fact>
          </FactGroup>
          <FactGroup title={t("ipActivity.group.activity")}>
            <Fact label={t("ipActivity.col.firstSeen")}>{formatDateTime(row.first_seen_at)}</Fact>
            <Fact label={t("ipActivity.col.lastSeen")}>{formatDateTime(row.last_seen_at)}</Fact>
            <Fact label={t("ipActivity.col.visits")}>
              <span className="sec-num">{row.visits_count}</span>
              <span className="meta ipa-facts__aside">{t("ipActivity.col.visitsHint")}</span>
            </Fact>
          </FactGroup>
        </div>
        <div className="ipa-details__place">
          <Place source={row.source} location={row.location ?? null} />
        </div>
      </div>
    </>
  );
};

/** A titled group of facts: device / place by IP / network / activity. */
const FactGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ipa-group">
    <h3 className="ipa-group__title">{title}</h3>
    <dl className="ipa-facts">{children}</dl>
  </section>
);

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </>
);

/** The same safe reference the table shows: an account, a mobile player, or nobody. */
const Who = ({ row }: { row: IIpActivityApi }) => {
  const { t } = useLang();
  if (row.user) {
    return (
      <p className="ipa-details__who">
        <span>{row.user.name}</span>
        <span className="meta">{row.user.email}</span>
        <span className="chip">{roleLabel(t, row.user.role)}</span>
      </p>
    );
  }
  if (row.guest) {
    return (
      <p className="ipa-details__who">
        <span>{row.guest.name ?? t("ipActivity.player")}</span>
        <span className="meta">{t("ipActivity.player")} #{row.guest.id}</span>
      </p>
    );
  }
  return (
    <p className="ipa-details__who muted">
      {row.source === "telegram_bot" ? t("ipActivity.telegramServers") : t("ipActivity.anonymous")}
    </p>
  );
};

/**
 * Where the address is, honestly: a map of the NETWORK's area with the
 * database's accuracy radius and a caption saying so, or a plain sentence
 * when there is nothing to draw. Telegram's servers never get a map, whatever
 * the payload says: their location says nothing about the user.
 */
const Place = ({ source, location }: { source: string; location: IIpActivityLocation | null }) => {
  const { t } = useLang();
  if (source === "telegram_bot") {
    return <p className="ipa-details__note">{t("ipActivity.details.telegramNote")}</p>;
  }
  if (!location) {
    return <StateView variant="empty" size="compact" titleKey="ipActivity.details.noLocation" descriptionKey={null} />;
  }
  const radius = location.accuracy_radius_km;
  const caption = radius
    ? fmt(t("ipActivity.details.caption"), Math.max(1, Math.round(radius)))
    : t("ipActivity.details.captionNoRadius");
  return (
    <figure className="ipa-details__map">
      <Suspense fallback={<Skeleton height={MAP_HEIGHT} radius={12} />}>
        <BranchMap
          markers={[]}
          center={{ lat: location.latitude, lng: location.longitude }}
          zoom={9}
          height={MAP_HEIGHT}
          accuracyRadiusKm={radius}
        />
      </Suspense>
      <figcaption className="ipa-details__caption">{caption}</figcaption>
    </figure>
  );
};

/** The repo's copy idiom (PairingTokenModal): clipboard, then "Copied" for a moment. */
const CopyButton = ({ text }: { text: string }) => {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch { /* clipboard refused: the address stays selectable */ }
  };

  return (
    <Button type="button" variant="secondary" className="sec-btn" onClick={() => void copy()}>
      {copied ? t("ipActivity.details.copied") : t("ipActivity.details.copyIp")}
    </Button>
  );
};

export default IpActivityDetailsModal;
