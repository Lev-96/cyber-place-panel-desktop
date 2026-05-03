import {
  apiDeleteTournamentRegistration,
  apiListTournamentRegistrations,
  ITournamentRegistration,
} from "@/api/tournamentRegistrations";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useLang } from "@/i18n/LanguageContext";
import { formatDateTime } from "@/i18n/dates";
import { useEffect, useMemo, useState } from "react";

interface Props {
  tournamentId: number;
}

/**
 * Tournament participants list — staff-facing view of every player /
 * spectator registered for the given tournament. Search bar filters
 * client-side by first or last name (or the legacy `name` fallback);
 * each row has a Remove button that deletes via the existing
 * `DELETE /tournament-registration/{id}` endpoint.
 *
 * Pure presenter on top of the registrations API. State machine is
 * the standard load/loading/error/empty quartet — no realtime hooks
 * here, the staff opens this page on demand.
 */
const RegistrationsList = ({ tournamentId }: Props) => {
  const { t } = useLang();
  const [items, setItems] = useState<ITournamentRegistration[] | null>(null);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    try {
      const { data } = await apiListTournamentRegistrations({
        tournament_id: tournamentId,
      });
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const remove = async (id: number) => {
    if (!confirm(t("registrations.confirmRemove") || "Remove registration?")) return;
    try {
      await apiDeleteTournamentRegistration(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to remove");
      return;
    }
    void load();
  };

  // Client-side filter — case-insensitive prefix/substring on
  // first_name + last_name + the legacy `name` so the input
  // matches whichever shape the row carries.
  const filtered = useMemo(() => {
    if (!items) return null;
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const first = r.guest?.first_name?.toLowerCase() ?? "";
      const last = r.guest?.last_name?.toLowerCase() ?? "";
      const name = r.guest?.name?.toLowerCase() ?? "";
      return first.includes(q) || last.includes(q) || name.includes(q);
    });
  }, [items, search]);

  return (
    <div className="col" style={{ gap: 10 }}>
      <h3 style={{ margin: 0 }}>
        {t("registrations.title") || "Participants"}
      </h3>
      <Input
        placeholder={t("registrations.searchPlaceholder") || "Filter by first or last name"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {err && <div className="error">{err}</div>}
      {!filtered ? (
        <Spinner />
      ) : (
        <div className="list">
          {filtered.map((r) => (
            <RegistrationRow key={r.id} reg={r} onRemove={() => void remove(r.id)} />
          ))}
          {!filtered.length && (
            <div className="muted">
              {items && items.length > 0
                ? t("registrations.noMatches") || "No matches."
                : t("registrations.empty") || "No registrations yet."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface RowProps {
  reg: ITournamentRegistration;
  onRemove: () => void;
}

const RegistrationRow = ({ reg, onRemove }: RowProps) => {
  const { t } = useLang();
  const first = reg.guest?.first_name?.trim() || null;
  const last = reg.guest?.last_name?.trim() || null;
  // Compose a display name from whatever the row has — split first
  // (full + most informative), then the legacy single-field name,
  // then a Guest-id placeholder so the row never reads as empty.
  const display =
    [first, last].filter(Boolean).join(" ") ||
    reg.guest?.name ||
    `Guest #${reg.guest_id}`;
  const roleLabel =
    reg.as === "player"
      ? t("registrations.rolePlayer") || "Player"
      : reg.as === "guest"
        ? t("registrations.roleGuest") || "Guest"
        : "";

  return (
    <div className="list-item">
      <div>
        <div className="name">{display}</div>
        <div className="meta">
          {roleLabel}
          {reg.created_at ? ` · ${formatDateTime(reg.created_at)}` : ""}
        </div>
      </div>
      <Button
        variant="secondary"
        onClick={onRemove}
        style={{
          padding: "6px 10px",
          fontSize: 12,
          color: "#ef4444",
          borderColor: "#4a1a1a",
        }}
      >
        {t("action.remove") || "Remove"}
      </Button>
    </div>
  );
};

export default RegistrationsList;
