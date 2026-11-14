import { apiPlatformInvoice } from "@/api/platformBilling";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import type { IPlatformInvoiceDetail } from "@/types/platformBilling";
import InvoiceDetailBody from "./InvoiceDetailBody";

interface Props {
  invoiceId: number;
  /** Bumped by the caller after a write, so the detail is read again. */
  version?: number;
  /** The detail as last read (the admin page needs it for its actions). */
  onLoaded?: (invoice: IPlatformInvoiceDetail) => void;
}

/**
 * One invoice, read from the server (`GET /platform-invoices/{id}`) and
 * printed. Read on every open: an invoice's balance and journal are live.
 */
const InvoiceView = ({ invoiceId, version = 0, onLoaded }: Props) => {
  const { data, loading, error, reload } = useAsync(async () => {
    const inv = await apiPlatformInvoice(invoiceId);
    onLoaded?.(inv);
    return inv;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, version]);

  if (loading && !data) return <SkeletonCard lines={6} />;
  if (error && !data) {
    return <ErrorState size="compact" error={error} onRetry={() => void reload()} titleKey="platformBilling.state.errorTitle" descriptionKey={null} />;
  }
  return data ? <InvoiceDetailBody invoice={data} /> : null;
};

export default InvoiceView;
