import { formatApiError } from "@/api/errors";
import BranchMap from "@/components/map/BranchMap";
import Button from "@/components/ui/Button";
import ImageUpload from "@/components/ui/ImageUpload";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { storageUri } from "@/infrastructure/AppConfig";
import { branchRepository } from "@/repositories/BranchRepository";
import { geocodeAddress, GeocodeResult } from "@/services/geocoding";
import { COUNTRIES, countryByCode, flagOf, resolveCountryCode } from "@/data/countries";
import { IBranchApi } from "@/types/api";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { FormEvent, useEffect, useRef, useState } from "react";

interface Props {
  initial?: IBranchApi;
  companyId?: number;
  onClose: () => void;
  onSaved: (b: IBranchApi) => void;
}

/** Default map center — Yerevan, since this product targets Armenia. */
const DEFAULT_CENTER = { lat: 40.18, lng: 44.5 };

const toCoord = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

type GeoStatus = "idle" | "searching" | "found" | "not-found" | "error";

const BranchForm = ({ initial, companyId, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  // `country` holds an ISO alpha-2 code (drives the strict dropdown + phone
  // validation). Legacy free-text values are resolved back to a code so
  // editing pre-selects the dropdown; on submit we send the English name.
  const [country, setCountry] = useState(resolveCountryCode(initial?.country));
  const [phone, setPhone] = useState(
    typeof initial?.phone === "string" ? initial.phone : "",
  );
  const [lat, setLat] = useState<number>(toCoord(initial?.address_lat));
  const [lng, setLng] = useState<number>(toCoord(initial?.address_lng));
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");

  // Address autocomplete suggestions (real addresses from the geocoder).
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  // Suppresses the dropdown for the one geocode round triggered *by* picking
  // a suggestion (we set the address programmatically and don't want it to
  // immediately reopen). Cleared the moment the user types again.
  const suppressSuggestRef = useRef(false);
  // True once the address/city/country were taken from a real geocoder match
  // (picked suggestion or an editing session that started from saved coords).
  // Submit is blocked until the location is geocoder-confirmed, so a player
  // never sees a made-up address/city.
  const addrConfirmedRef = useRef(!!initial && toCoord(initial.address_lat) !== 0);

  // Once user pins manually, stop overwriting from auto-geocoding.
  const userPinnedRef = useRef(!!initial && toCoord(initial.address_lat) !== 0);

  const fullQuery = [address, city, country]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const debouncedQuery = useDebouncedValue(fullQuery, 600);

  useEffect(() => {
    if (debouncedQuery.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      setGeoStatus("idle");
      return;
    }
    let cancelled = false;
    setGeoStatus("searching");
    geocodeAddress(debouncedQuery)
      .then((results) => {
        if (cancelled) return;
        setSuggestions(results);
        setActiveIdx(-1);
        // Show the suggestion list unless this round was triggered by the
        // user picking a suggestion (programmatic address set).
        if (suppressSuggestRef.current) suppressSuggestRef.current = false;
        else setShowSuggestions(results.length > 0);
        const first = results[0];
        if (first) {
          // A real geocoder match — the location is confirmed.
          addrConfirmedRef.current = true;
          // Auto-pin the best match for convenience, but never fight a pin
          // the user placed by hand (map click / manual coords / picked item).
          if (!userPinnedRef.current) {
            setLat(first.lat);
            setLng(first.lng);
          }
          // Backfill verified city / country when the user left them blank.
          if (first.city) setCity((c) => c || first.city);
          if (first.countryCode) applyCountryCode(first.countryCode, true);
          setGeoStatus("found");
        } else {
          addrConfirmedRef.current = false;
          setGeoStatus("not-found");
        }
      })
      .catch(() => {
        if (!cancelled) setGeoStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  /** Apply an ISO country code to the dropdown if it's an allowed country.
   *  `onlyIfEmpty` keeps a value the user already chose. */
  const applyCountryCode = (cc: string, onlyIfEmpty = false) => {
    const found = COUNTRIES.find((c) => c.code === cc.toUpperCase());
    if (!found) return; // unknown or product-excluded (RU/AZ/TR) — leave as is
    setCountry((cur) => (onlyIfEmpty && cur ? cur : found.code));
  };

  /** User typed in the address field — allow the dropdown to reopen and
   *  invalidate the previous confirmation until the geocoder re-confirms. */
  const onAddressChange = (v: string) => {
    suppressSuggestRef.current = false;
    addrConfirmedRef.current = false;
    setAddress(v);
  };

  /** User picked a real address from the dropdown — save the SHORT, readable
   *  label (e.g. "Samvel Safaryan 14"), pin it precisely, and fill the
   *  verified city / country from the same result. */
  const onPickSuggestion = (s: GeocodeResult) => {
    suppressSuggestRef.current = true;
    userPinnedRef.current = true;
    addrConfirmedRef.current = true;
    setAddress(s.shortAddress || s.displayName);
    if (s.city) setCity(s.city);
    if (s.countryCode) applyCountryCode(s.countryCode);
    setLat(s.lat);
    setLng(s.lng);
    setGeoStatus("found");
    setShowSuggestions(false);
    setActiveIdx(-1);
  };

  /** Keyboard navigation for the suggestion list. */
  const onAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      onPickSuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const onMapPick = (la: number, ln: number) => {
    userPinnedRef.current = true;
    setLat(la);
    setLng(ln);
    setGeoStatus("found");
  };
  const onLatChange = (v: string) => {
    userPinnedRef.current = true;
    setLat(Number(v) || 0);
  };
  const onLngChange = (v: string) => {
    userPinnedRef.current = true;
    setLng(Number(v) || 0);
  };

  const hasCoords = lat !== 0 && lng !== 0;
  const markers = hasCoords
    ? [{ lat, lng, label: address || t("branchForm.selectedLocation") }]
    : [];

  // Strict, offline phone validation for the selected country (libphonenumber).
  const phoneParsed =
    phone.trim() && country
      ? parsePhoneNumberFromString(phone, country as CountryCode)
      : undefined;
  const phoneValid = !!phoneParsed && phoneParsed.isValid();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Location must be a real, geocoder-confirmed place — not free text.
    if (!hasCoords || !addrConfirmedRef.current) {
      setErr(t("branchForm.pickFromList"));
      return;
    }
    if (!city.trim()) {
      setErr(t("branchForm.cityRequired"));
      return;
    }
    if (!country) {
      setErr(t("company.selectCountryFirst"));
      return;
    }
    if (!phoneValid) {
      setErr(t("branchForm.invalidPhone"));
      return;
    }
    // Persist the country as its English name (backend stores free text) and
    // a normalized E.164 phone.
    const countryName = countryByCode(country)?.name ?? country;
    setBusy(true);
    setErr(null);
    try {
      const body = {
        address,
        city,
        country: countryName,
        phone: phoneParsed!.formatInternational(),
        address_lat: lat,
        address_lng: lng,
        company_id: companyId,
        ...(logo ? { branch_logo_path: logo } : {}),
      };
      const b = initial
        ? await branchRepository.update(initial.id, body)
        : await branchRepository.create(body as Required<typeof body>);
      onSaved(b);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <form
        className="card"
        style={{
          width: 640,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
        onSubmit={submit}
      >
        <h2 style={{ margin: 0 }}>
          {initial ? t("branch.titleEdit") : t("branch.titleNew")}
        </h2>

        <div style={{ position: "relative" }}>
          <Input
            label={t("branch.address")}
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={onAddressKeyDown}
            required
            autoFocus
            autoComplete="off"
            placeholder={t("branch.addressPlaceholder")}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="cp-addr-suggest" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={`${s.lat},${s.lng},${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  className={
                    "cp-addr-suggest__item" +
                    (i === activeIdx ? " cp-addr-suggest__item--active" : "")
                  }
                  // Prevent the input's blur from firing before the click.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => onPickSuggestion(s)}
                >
                  <span className="cp-addr-suggest__pin">📍</span>
                  <span>{s.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input
              label={t("branch.city")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder={t("branchForm.cityFromAddress")}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span className="label">{t("branch.country")}</span>
            <select
              className="input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
            >
              <option value="">{t("company.selectCountry")}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {flagOf(c.code)} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Input
            label={t("label.phone")}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder={country ? `+${countryByCode(country)?.dial ?? ""} …` : ""}
          />
          {phone.trim() !== "" && !phoneValid && (
            <span className="muted" style={{ fontSize: 11, color: "#ef4444" }}>
              {t("branchForm.invalidPhone")}
            </span>
          )}
        </div>

        <ImageUpload
          label={t("branch.logo")}
          name={address || city}
          initialUrl={initial ? storageUri(initial.branch_logo_path) : null}
          onChange={setLogo}
        />

        <div className="col" style={{ gap: 6 }}>
          <div className="row-between">
            <span className="label" style={{ margin: 0 }}>
              {t("branchForm.locationLabel")}
            </span>
            <span className="muted" style={{ fontSize: 11 }}>
              {statusLabel(geoStatus, t)}
            </span>
          </div>
          <BranchMap
            markers={markers}
            center={hasCoords ? { lat, lng } : DEFAULT_CENTER}
            zoom={hasCoords ? 15 : 12}
            height={280}
            onPick={onMapPick}
          />
          <div className="row" style={{ gap: 10 }}>
            <Input
              label={t("branchForm.latitude")}
              type="number"
              step="0.000001"
              value={lat || ""}
              onChange={(e) => onLatChange(e.target.value)}
            />
            <Input
              label={t("branchForm.longitude")}
              type="number"
              step="0.000001"
              value={lng || ""}
              onChange={(e) => onLngChange(e.target.value)}
            />
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            {t("branchForm.autoLocateHint")}
          </span>
        </div>

        {err && (
          <div className="error" style={{ whiteSpace: "pre-line" }}>
            {err}
          </div>
        )}
        <div className="row-between">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            {t("action.cancel")}
          </Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

const statusLabel = (s: GeoStatus, t: (k: string) => string): string => {
  switch (s) {
    case "searching":
      return t("branchForm.searching");
    case "found":
      return t("branchForm.pinned");
    case "not-found":
      return t("branchForm.addrNotFound");
    case "error":
      return t("branchForm.geoFailed");
    default:
      return t("branchForm.typeOrClick");
  }
};

export default BranchForm;
