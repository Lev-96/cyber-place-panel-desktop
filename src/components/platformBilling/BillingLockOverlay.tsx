import { useAuth } from "@/auth/AuthContext";
import { useState } from "react";
import PlatformBillingModal from "./PlatformBillingModal";
import type { BillingAccess } from "@/types/platformBilling";

export type BillingLockArea = "sessions" | "tournaments";

/**
 * The owner's words for a screen that an unpaid Cyber Place Platform invoice
 * limits (2026-11-09). ARMENIAN, plain and spoken: what is closed, what still
 * works, how it comes back. «սեսիա» for a session, as everywhere in the panel.
 */
const TEXT: Record<BillingLockArea, Record<Exclude<BillingAccess, "active">, { title: string; lines: string[] }>> = {
  sessions: {
    restricted: {
      title: "Մասնաճյուղի աշխատանքը սահմանափակված է",
      lines: [
        "Cyber Place Platform-ի վճարումն ուշացել է, այդ պատճառով նոր սեսիաներ սկսել հնարավոր չէ։",
        "Արդեն սկսված սեսիաները շարունակում են աշխատել։ Դրանք կարող եք կանգնեցնել և վճարել ինչպես միշտ։",
        "Վճարելուց հետո ամեն ինչ անմիջապես կվերականգնվի։",
      ],
    },
    suspended: {
      title: "Մասնաճյուղը ժամանակավորապես արգելափակված է",
      lines: [
        "Cyber Place Platform-ի պարտքը դեռ մարված չէ, այդ պատճառով նոր սեսիաներ սկսել հնարավոր չէ։",
        "Արդեն սկսված սեսիաները շարունակում են աշխատել։ Դրանք կարող եք կանգնեցնել և վճարել ինչպես միշտ։",
        "Պարտքը մարելուց հետո ամեն ինչ անմիջապես կվերականգնվի։",
      ],
    },
  },
  tournaments: {
    restricted: {
      title: "Նոր մրցաշարեր ստեղծել հնարավոր չէ",
      lines: [
        "Cyber Place Platform-ի վճարումն ուշացել է, այդ պատճառով նոր մրցաշարեր ստեղծել հնարավոր չէ։",
        "Արդեն ստեղծված մրցաշարերը և դրանց մասնակիցները պահպանված են։",
        "Վճարելուց հետո ամեն ինչ անմիջապես կվերականգնվի։",
      ],
    },
    suspended: {
      title: "Մրցաշարերը ժամանակավորապես արգելափակված են",
      lines: [
        "Cyber Place Platform-ի պարտքը դեռ մարված չէ, այդ պատճառով նոր մրցաշարեր ստեղծել և դրանք խմբագրել հնարավոր չէ։",
        "Արդեն ստեղծված մրցաշարերը և դրանց մասնակիցները պահպանված են։",
        "Պարտքը մարելուց հետո ամեն ինչ անմիջապես կվերականգնվի։",
      ],
    },
  },
};

interface Props {
  access: BillingAccess;
  area: BillingLockArea;
}

/**
 * A blurred cover over a screen an unpaid invoice limits, with the reason in
 * the middle (owner, 2026-11-09): staff see WHY before they press Start, not
 * after. It never traps them: running seats must still be stopped and paid,
 * so «Շարունակել» lifts the cover for this visit. The server still refuses
 * every gated action on its own; this is the explanation, not the lock.
 */
const BillingLockOverlay = ({ access, area }: Props) => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [debtOpen, setDebtOpen] = useState(false);
  if (access === "active" || dismissed) return null;

  const text = TEXT[area][access];
  const companyId = user?.dashboard?.company_id ?? null;
  const canSeeDebt = user?.role === "company_owner" && companyId !== null;

  return (
    <div className={`billing-lock billing-lock--${access}`} role="alertdialog" aria-modal="false" aria-labelledby="billing-lock-title" lang="hy" data-billing-lock={area}>
      <div className="billing-lock__card">
        <div className="billing-lock__icon" aria-hidden="true">{access === "suspended" ? "🚫" : "⛔"}</div>
        <h2 id="billing-lock-title" className="billing-lock__title">{text.title}</h2>
        {text.lines.map((line) => <p key={line} className="billing-lock__line">{line}</p>)}
        <div className="billing-lock__actions">
          {canSeeDebt && (
            <button type="button" className="btn billing-lock__debt" onClick={() => setDebtOpen(true)}>Տեսնել պարտքը</button>
          )}
          <button type="button" className="btn secondary billing-lock__continue" onClick={() => setDismissed(true)}>Շարունակել</button>
        </div>
      </div>
      {debtOpen && <PlatformBillingModal companyId={companyId} invoiceId={null} onClose={() => setDebtOpen(false)} />}
    </div>
  );
};

export default BillingLockOverlay;
