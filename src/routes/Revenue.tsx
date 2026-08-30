import CompanyRevenueScreen from "@/components/revenue/CompanyRevenueScreen";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { companyRepository } from "@/repositories/CompanyRepository";
import { useEffect, useState } from "react";

/**
 * What a company owes us this month.
 *
 * ## An owner has one company, so there is nothing to pick
 * The screen used to open on a company selector for everyone. For an admin
 * that is the whole point — they answer for the fleet. For an owner it was a
 * dropdown with one entry in front of the only answer it could give, and a
 * question the app already knew: the listing is scoped server-side, so an
 * owner's own company is simply the one it returns.
 *
 * The picker is therefore rendered only when there is genuinely something to
 * choose between. That is a display decision on top of a server one — the
 * summary endpoint refuses a company the caller does not own regardless of
 * what the client asks for.
 */
const Revenue = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: companies, loading, error } = useAsync(() => companyRepository.list(), []);
  const [companyId, setCompanyId] = useState<number | null>(null);

  const list = companies ?? [];
  // One company in reach — an owner, or an admin of a one-company platform —
  // means the answer is that one, chosen without asking.
  const single = list.length === 1 ? list[0] : null;

  useEffect(() => {
    if (single && companyId === null) setCompanyId(single.id);
  }, [single, companyId]);

  const selected = list.find((c) => c.id === companyId) ?? null;
  const showPicker = list.length > 1;

  return (
    <ScreenWithBg bg="./bg/company.jpg" title={t("revenue.title")}>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="col" style={{ gap: 12 }}>
          {showPicker && (
            <div className="col" style={{ gap: 6 }}>
              <span className="label">{t("label.company")}</span>
              <select
                className="input"
                value={companyId ?? ""}
                onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t("revenue.pickCompany")}</option>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {selected && (
            <CompanyRevenueScreen
              companyId={selected.id}
              companyName={selected.name}
              initialPercent={
                selected.raw.commission_percent != null && selected.raw.commission_percent !== ""
                  ? Number(selected.raw.commission_percent)
                  : undefined
              }
            />
          )}

          {/* Only ever shown to somebody who actually has a choice to make. */}
          {!selected && showPicker && <div className="muted">{t("revenue.pickHint")}</div>}

          {/* A staff account attached to no company at all: say so, rather
              than leaving an empty screen that looks like a failed load. */}
          {!selected && !showPicker && list.length === 0 && (
            <div className="muted">{t("revenue.noCompany")}</div>
          )}
        </div>
      )}
    </ScreenWithBg>
  );
};

export default Revenue;
