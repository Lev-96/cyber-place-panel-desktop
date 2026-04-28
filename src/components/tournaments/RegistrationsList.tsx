import { apiCreateTournamentRegistration, apiDeleteTournamentRegistration, apiListTournamentRegistrations } from "@/api/tournamentRegistrations";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { ITournamentRegistration } from "@/api/tournamentRegistrations";
import { useEffect, useState } from "react";

interface Props {
  tournamentId: number;
}

const RegistrationsList = ({ tournamentId }: Props) => {
  const [items, setItems] = useState<ITournamentRegistration[] | null>(null);
  const [guestId, setGuestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    try { setItems((await apiListTournamentRegistrations({ tournament_id: tournamentId })).data); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [tournamentId]);

  const add = async () => {
    const id = Number(guestId);
    if (!Number.isFinite(id) || id <= 0) return setErr("Invalid guest id");
    setBusy(true); setErr(null);
    try { await apiCreateTournamentRegistration({ tournament_id: tournamentId, guest_id: id }); setGuestId(""); void load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Remove registration?")) return;
    await apiDeleteTournamentRegistration(id);
    void load();
  };

  return (
    <div className="col" style={{ gap: 10 }}>
      <h3 style={{ margin: 0 }}>Participants</h3>
      <div className="row" style={{ gap: 6 }}>
        <Input label="" placeholder="Guest id to register" value={guestId} onChange={(e) => setGuestId(e.target.value)} type="number" min={1} />
        <Button onClick={add} disabled={busy}>{busy ? "Adding…" : "Register"}</Button>
      </div>
      {err && <div className="error">{err}</div>}
      {!items ? <Spinner /> : (
        <div className="list">
          {items.map((r) => (
            <div key={r.id} className="list-item">
              <div>
                <div className="name">{r.guest?.name ?? `Guest #${r.guest_id}`}</div>
                <div className="meta">{r.guest?.phone ?? ""} {r.created_at && `· ${new Date(r.created_at).toLocaleString()}`}</div>
              </div>
              <Button variant="secondary" onClick={() => remove(r.id)} style={{ padding: "6px 10px", fontSize: 12, color: "#ef4444", borderColor: "#4a1a1a" }}>Remove</Button>
            </div>
          ))}
          {!items.length && <div className="muted">No registrations yet.</div>}
        </div>
      )}
    </div>
  );
};

export default RegistrationsList;
