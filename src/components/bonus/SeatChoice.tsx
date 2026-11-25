import Switch from "@/components/ui/Switch";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { placeRepository } from "@/repositories/PlaceRepository";
import type { IBranchPlace } from "@/types/api";
import { platformLabel } from "@/utils/platform";

interface Props {
  branchId: number;
  /** The chosen place ids; null = every seat. */
  value: number[] | null;
  onChange: (next: number[] | null) => void;
  disabled?: boolean;
}

interface Group { key: string; label: string; places: IBranchPlace[] }

/**
 * Which seats may win the time bonus (2026-11-25, owner): every seat, or the
 * ones ticked — a whole group at once (the platform, its sub-category such as
 * «Большой VIP», VIP or standard) or seat by seat.
 */
const SeatChoice = ({ branchId, value, onChange, disabled = false }: Props) => {
  const { t, lang } = useLang();
  const places = useAsync(() => placeRepository.listRawByBranch(branchId), [branchId]);
  const all = value === null;
  const chosen = new Set(value ?? []);

  const subName = (p: IBranchPlace) => {
    const s = p.subplatform;
    if (!s) return null;
    return (lang === "ru" ? s.name_ru : lang === "am" ? s.name_am : s.name_en) || s.name_en;
  };
  const groups: Group[] = [];
  for (const p of (places.data ?? []).filter((x) => x.status === "active").sort((a, b) => (a.number ?? a.id) - (b.number ?? b.id))) {
    const parts = [platformLabel(p.platform), subName(p), p.type === "vip" ? "VIP" : null].filter(Boolean);
    const key = parts.join(" · ");
    const g = groups.find((x) => x.key === key);
    if (g) g.places.push(p); else groups.push({ key, label: key, places: [p] });
  }

  const set = (ids: number[], on: boolean) => {
    const next = new Set(chosen);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    onChange([...next]);
  };

  return (
    <div className="col" style={{ gap: 10 }} data-testid="seat-choice">
      <Switch checked={all} onChange={(on) => onChange(on ? null : [])} disabled={disabled} label={t("timeBonus.seats.all")} />
      {!all && (
        <div className="col" style={{ gap: 10 }}>
          {places.loading && <span className="muted">…</span>}
          {groups.map((g) => {
            const ids = g.places.map((p) => p.id);
            const every = ids.every((id) => chosen.has(id));
            return (
              <fieldset key={g.key} className="seat-choice__group" data-testid="seat-group">
                <legend>
                  <label className="row" style={{ gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={every} disabled={disabled} onChange={(e) => set(ids, e.target.checked)} data-testid={`seat-group-${g.key}`} />
                    <strong>{g.label}</strong>
                  </label>
                </legend>
                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                  {g.places.map((p) => (
                    <label key={p.id} className="row" style={{ gap: 6, alignItems: "center" }}>
                      <input type="checkbox" checked={chosen.has(p.id)} disabled={disabled} onChange={(e) => set([p.id], e.target.checked)} data-testid={`seat-${p.id}`} />
                      <span>{"№" + (p.number ?? p.id) + (p.name ? " · " + p.name : "")}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          {chosen.size === 0 && <span className="error" style={{ fontSize: 13 }}>{t("timeBonus.seats.none")}</span>}
        </div>
      )}
    </div>
  );
};

export default SeatChoice;
