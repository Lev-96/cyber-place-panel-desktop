import { billingBlock } from "@/auth/billingBlock";
import { useSyncExternalStore } from "react";

/**
 * The company's access closed for an unpaid Cyber Place Platform bill (owner,
 * 2026-11-09): one plain screen in Armenian, over whatever is showing — the
 * sign-in screen included — saying what happened, whom to call and that it
 * comes back once paid. «Հասկանալի է» closes it; the server keeps refusing
 * until the bill is settled, so closing it opens nothing.
 */
const BillingBlockedModal = () => {
  const shown = useSyncExternalStore(billingBlock.subscribe, billingBlock.isShown, billingBlock.isShown);
  if (!shown) return null;

  return (
    <div className="billing-lock billing-lock--suspended billing-lock--screen" role="alertdialog" aria-modal="true" aria-labelledby="billing-blocked-title" lang="hy" data-testid="billing-blocked">
      <div className="billing-lock__card">
        <div className="billing-lock__icon" aria-hidden="true">🔒</div>
        <h2 id="billing-blocked-title" className="billing-lock__title">Մուտքը ժամանակավորապես արգելափակված է</h2>
        <p className="billing-lock__line">Cyber Place Platform-ի պարտքի պատճառով ձեր ընկերության հաշիվը ժամանակավորապես արգելափակված է։</p>
        <p className="billing-lock__line">Պարտքը մարելու և մանրամասների համար կապվեք Cyber Place-ի ադմինիստրատորի հետ։</p>
        <p className="billing-lock__line">Պարտքը մարելուց հետո մուտքն անմիջապես կվերականգնվի։</p>
        <div className="billing-lock__actions">
          <button type="button" className="btn" onClick={() => billingBlock.dismiss()}>Հասկանալի է</button>
        </div>
      </div>
    </div>
  );
};

export default BillingBlockedModal;
