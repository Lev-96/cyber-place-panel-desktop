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
import { geocodeAddress } from "@/services/geocoding";
import { IBranchApi } from "@/types/api";
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
  const [country, setCountry] = useState(initial?.country ?? "");
  const [phone, setPhone] = useState(typeof initial?.phone === "string" ? initial.phone : "");
  const [lat, setLat] = useState<number>(toCoord(initial?.address_lat));
  const [lng, setLng] = useState<number>(toCoord(initial?.address_lng));
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");

  // Once user pins manually, stop overwriting from auto-geocoding.
  const userPinnedRef = useRef(!!initial && (toCoord(initial.address_lat) !== 0));

  const fullQuery = [address, city, country].map((s) => s.trim()).filter(Boolean).join(", ");
  const debouncedQuery = useDebouncedValue(fullQuery, 600);

  useEffect(() => {
    if (userPinnedRef.current) return;
    if (debouncedQuery.length < 4) { setGeoStatus("idle"); return; }
    let cancelled = false;
    setGeoStatus("searching");
    geocodeAddress(debouncedQuery)
      .then((results) => {
        if (cancelled) return;
        const first = results[0];
        if (first) { setLat(first.lat); setLng(first.lng); setGeoStatus("found"); }
        else setGeoStatus("not-found");
      })
      .catch(() => { if (!cancelled) setGeoStatus("error"); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const onMapPick = (la: number, ln: number) => {
    userPinnedRef.current = true;
    setLat(la); setLng(ln);
    setGeoStatus("found");
  };
  const onLatChange = (v: string) => { userPinnedRef.current = true; setLat(Number(v) || 0); };
  const onLngChange = (v: string) => { userPinnedRef.current = true; setLng(Number(v) || 0); };

  const hasCoords = lat !== 0 && lng !== 0;
  const markers = hasCoords ? [{ lat, lng, label: address || t("branchForm.selectedLocation") }] : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasCoords) {
      setErr(t("branchForm.pickLocationFirst"));
      return;
    }
    setBusy(true); setErr(null);
    try {
      const body = {
        address, city, country, phone,
        address_lat: lat, address_lng: lng,
        company_id: companyId,
        ...(logo ? { branch_logo_path: logo } : {}),
      };
      const b = initial
        ? await branchRepository.update(initial.id, body)
        : await branchRepository.create(body as Required<typeof body>);
      onSaved(b);
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 640, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("branch.titleEdit") : t("branch.titleNew")}</h2>

        <Input label={t("branch.address")} value={address} onChange={(e) => setAddress(e.target.value)} required autoFocus placeholder="e.g. Samvel Safaryan 14" />
        <div className="row" style={{ gap: 10 }}>
          <Input label={t("branch.city")} value={city} onChange={(e) => setCity(e.target.value)} required />
          <Input label={t("branch.country")} value={country} onChange={(e) => setCountry(e.target.value)} required />
        </div>
        <Input label={t("label.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} required />

        <ImageUpload
          label={t("branch.logo")}
          name={address || city}
          initialUrl={initial ? storageUri(initial.branch_logo_path) : null}
          onChange={setLogo}
        />

        <div className="col" style={{ gap: 6 }}>
          <div className="row-between">
            <span className="label" style={{ margin: 0 }}>{t("branchForm.locationLabel")}</span>
            <span className="muted" style={{ fontSize: 11 }}>{statusLabel(geoStatus, t)}</span>
          </div>
          <BranchMap
            markers={markers}
            center={hasCoords ? { lat, lng } : DEFAULT_CENTER}
            zoom={hasCoords ? 15 : 12}
            height={280}
            onPick={onMapPick}
          />
          <div className="row" style={{ gap: 10 }}>
            <Input label={t("branchForm.latitude")} type="number" step="0.000001" value={lat || ""} onChange={(e) => onLatChange(e.target.value)} />
            <Input label={t("branchForm.longitude")} type="number" step="0.000001" value={lng || ""} onChange={(e) => onLngChange(e.target.value)} />
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            {t("branchForm.autoLocateHint")}
          </span>
        </div>

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

const statusLabel = (s: GeoStatus, t: (k: string) => string): string => {
  switch (s) {
    case "searching": return t("branchForm.searching");
    case "found":     return t("branchForm.pinned");
    case "not-found": return t("branchForm.addrNotFound");
    case "error":     return t("branchForm.geoFailed");
    default:          return t("branchForm.typeOrClick");
  }
};

export default BranchForm;
