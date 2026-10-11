import { apiConfirmBookingByCode } from "@/api/bookings";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useLang } from "@/i18n/LanguageContext";
import { IBookingApi } from "@/types/api";
import { FormEvent, useState } from "react";

/** A booking code is exactly six digits — the server's rule (`digits:6`). */
const BOOKING_CODE_LENGTH = 6;

/**
 * What the code box keeps of anything typed or pasted: its digits, the first
 * six. A string throughout, so a leading zero ("001234") survives. No
 * `maxLength` on the box: it would cut a paste such as "12 34 56" BEFORE the
 * spaces are dropped, keeping "1234".
 */
const toBookingCode = (raw: string): string =>
  raw.replace(/\D+/g, "").slice(0, BOOKING_CODE_LENGTH);

const ConfirmByCode = () => {
  const { t } = useLang();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<IBookingApi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const complete = code.length === BOOKING_CODE_LENGTH;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Enter submits the form even past a disabled button's look; an incomplete
    // code never leaves the panel, as the server would refuse it anyway.
    if (!complete || busy) return;
    setBusy(true); setErr(null); setConfirmed(null);
    try { setConfirmed((await apiConfirmBookingByCode(code)).booking); setCode(""); }
    catch (e) { setErr(e instanceof Error ? e.message : t("bookings.invalidCode")); }
    finally { setBusy(false); }
  };

  return (
    <ScreenWithBg bg="./bg/booking.jpg" title={t("bookings.confirmTitle")}>
      <form className="gradient-card" onSubmit={submit}>
        <div className="gradient-card-inner">
          <h3 style={{ margin: 0 }}>{t("bookings.enterCode")}</h3>
          <Input
            label={t("bookings.bookingCode")}
            value={code}
            onChange={(e) => setCode(toBookingCode(e.target.value))}
            required
            autoFocus
            placeholder={t("bookings.codePlaceholder")}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern={`\\d{${BOOKING_CODE_LENGTH}}`}
          />
          {err && <div className="error">{err}</div>}
          <Button disabled={busy || !complete}>{busy ? t("common.checking") : t("action.confirm")}</Button>
        </div>
      </form>
      {confirmed && (
        <div className="gradient-card"><div className="gradient-card-inner">
          <h3 style={{ margin: 0 }}>{t("bookings.confirmedOk")}</h3>
          <div className="kv-row"><span className="k">{t("label.code")}</span><span className="v">{confirmed.code}</span></div>
          <div className="kv-row"><span className="k">{t("label.status")}</span><span className="v"><span className={`pill ${confirmed.status}`}>{confirmed.status}</span></span></div>
          <div className="kv-row"><span className="k">{t("label.date")}</span><span className="v">{confirmed.booking_date} {confirmed.start_time}</span></div>
          <div className="kv-row"><span className="k">{t("label.duration")}</span><span className="v">{confirmed.duration_minutes} {t("time.minShort")}</span></div>
          <div className="kv-row"><span className="k">{t("label.places")}</span><span className="v">{confirmed.place_booking_count}</span></div>
          {confirmed.company && <div className="kv-row"><span className="k">{t("label.company")}</span><span className="v">{confirmed.company.name}</span></div>}
        </div></div>
      )}
    </ScreenWithBg>
  );
};

export default ConfirmByCode;
