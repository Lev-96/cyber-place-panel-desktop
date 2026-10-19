import MosaicCaptcha from "@/components/login/MosaicCaptcha";
import Modal from "@/components/ui/Modal";
import { CaptchaClient } from "@/api/captcha";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  open: boolean;
  client: CaptchaClient;
  onSolved: (token: string) => void;
  onClose: () => void;
}

/**
 * The sign-in mosaic in a dialog (2026-10-07). A dialog rather than a block on
 * the card: the desktop's sign-in card is too small for it at the smallest
 * window, and on a phone a dialog keeps the picture at full width. Closing it
 * cancels; the sign-in asks again on the next attempt.
 */
const CaptchaDialog = ({ open, client, onSolved, onClose }: Props) => {
  const { t } = useLang();
  if (!open) return null;

  return (
    <Modal open onClose={onClose} dirty={false}>
      <div className="card mosaic-dialog">
        <p className="mosaic-dialog__why">{t("captcha.needed")}</p>
        <MosaicCaptcha client={client} onSolved={onSolved} />
      </div>
    </Modal>
  );
};

export default CaptchaDialog;
