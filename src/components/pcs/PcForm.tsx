import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { pcRepository } from "@/repositories/PcRepository";
import { IPcApi } from "@/types/sessions";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: IPcApi;
  onClose: () => void;
  onSaved: (pc: IPcApi) => void;
}

const PcForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [mac, setMac] = useState(initial?.mac_address ?? "");
  const [placeId, setPlaceId] = useState<string>(initial?.place_id ? String(initial.place_id) : "");
  const [kind, setKind] = useState<"pc" | "ps">(initial?.kind ?? "pc");
  const [rate, setRate] = useState<string>(initial?.hourly_rate != null ? String(initial.hourly_rate) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const place_id = placeId ? Number(placeId) : null;
      const hourly_rate = rate.trim() === "" ? null : Number(rate.replace(",", "."));
      const body = { label, kind, hourly_rate, mac_address: mac || null, place_id };
      const pc = initial
        ? await pcRepository.update(initial.id, body)
        : await pcRepository.create({ branch_id: branchId, ...body });
      onSaved(pc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("pcs.editDevice") : t("pcs.newDevice")}</h2>

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("pcs.kind")}</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={() => setKind("pc")} style={tabStyle(kind === "pc")}>{t("pcs.kindPc")}</button>
            <button type="button" onClick={() => setKind("ps")} style={tabStyle(kind === "ps")}>{t("pcs.kindPs")}</button>
          </div>
        </div>

        <Input label={t("pcs.label")} value={label} onChange={(e) => setLabel(e.target.value)} required autoFocus />

        <Input
          label={t("session.hourlyRate")}
          inputMode="decimal"
          placeholder="1000"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />

        {kind === "pc" && (
          <>
            <Input
              label="MAC address"
              placeholder="AA:BB:CC:DD:EE:FF"
              value={mac ?? ""}
              onChange={(e) => setMac(e.target.value)}
            />
            <span className="muted" style={{ fontSize: 11, marginTop: -8 }}>
              {t("pcs.macHint")}
            </span>
          </>
        )}
        {kind === "ps" && (
          <span className="muted" style={{ fontSize: 12 }}>
            {t("pcs.psHint")}
          </span>
        )}
        <Input label={t("pcs.placeId")} type="number" value={placeId} onChange={(e) => setPlaceId(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy || !label}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 10px",
  border: `1px solid ${active ? "#07ddf1" : "#1f2a44"}`,
  background: active ? "#101a35" : "transparent",
  color: active ? "#07ddf1" : "#9aa8c7",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
});

export default PcForm;
