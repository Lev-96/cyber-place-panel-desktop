import { apiConfirmBookingByCode } from "@/api/bookings";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { IBookingApi } from "@/types/api";
import { FormEvent, useState } from "react";

const ConfirmByCode = () => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<IBookingApi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setConfirmed(null);
    try { setConfirmed((await apiConfirmBookingByCode(code)).booking); setCode(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Invalid code"); }
    finally { setBusy(false); }
  };

  return (
    <ScreenWithBg bg="./bg/booking.jpg" title="Confirm booking by code">
      <form className="gradient-card" onSubmit={submit}>
        <div className="gradient-card-inner">
          <h3 style={{ margin: 0 }}>Enter customer's code</h3>
          <Input label="Booking code" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus placeholder="e.g. 482931" />
          {err && <div className="error">{err}</div>}
          <Button disabled={busy || !code}>{busy ? "Checking…" : "Confirm"}</Button>
        </div>
      </form>
      {confirmed && (
        <div className="gradient-card"><div className="gradient-card-inner">
          <h3 style={{ margin: 0 }}>Confirmed ✓</h3>
          <div className="kv-row"><span className="k">Code</span><span className="v">{confirmed.code}</span></div>
          <div className="kv-row"><span className="k">Status</span><span className="v"><span className={`pill ${confirmed.status}`}>{confirmed.status}</span></span></div>
          <div className="kv-row"><span className="k">Date</span><span className="v">{confirmed.booking_date} {confirmed.start_time}</span></div>
          <div className="kv-row"><span className="k">Duration</span><span className="v">{confirmed.duration_minutes} min</span></div>
          <div className="kv-row"><span className="k">Places</span><span className="v">{confirmed.place_booking_count}</span></div>
          {confirmed.company && <div className="kv-row"><span className="k">Company</span><span className="v">{confirmed.company.name}</span></div>}
        </div></div>
      )}
    </ScreenWithBg>
  );
};

export default ConfirmByCode;
