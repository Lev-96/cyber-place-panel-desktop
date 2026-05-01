import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({
  open,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: Props) => {
  const { t } = useLang();
  return (
    <Modal open={open} onClose={onCancel}>
      <div
        className="card"
        style={{ width: 380, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>{message}</div>
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel ?? t("action.cancel")}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            style={destructive ? { background: "#7a1f1f", borderColor: "#4a1a1a" } : undefined}
          >
            {confirmLabel ?? t("action.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
