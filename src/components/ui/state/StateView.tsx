import { ReactNode } from "react";
import { useLang } from "@/i18n/LanguageContext";
import { LocalizedText, renderText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import GamerIllustration from "./GamerIllustration";
import { STATE_VARIANTS, StateVariant } from "./variants";

export type StateViewSize = "page" | "section" | "compact";

export interface StateViewProps {
  variant: StateVariant;
  /** Translation key of the title; the variant's default when omitted. */
  titleKey?: string;
  /** Translation key of the sentence under it; `null` = no sentence. */
  descriptionKey?: string | null;
  /** `{0}`… values for the title / description. */
  args?: (string | number)[];
  /** A secondary line: e.g. the server's own sentence for an unknown failure. */
  detail?: LocalizedText | null;
  /** Buttons / links under the text (Retry, Back, "+ Add branch"). */
  actions?: ReactNode;
  /**
   * `page` — a whole screen's state (illustration, ~168px);
   * `section` — a card or tab inside a page (smaller illustration);
   * `compact` — inside a dialog, dropdown or form row: text only, no player.
   */
  size?: StateViewSize;
  className?: string;
}

/**
 * The one layout for empty / no results / not found / error / offline /
 * success. Sized to its container (never the body), centred, text carries the
 * meaning — the illustration is decoration (`aria-hidden`).
 */
const StateView = ({ variant, titleKey, descriptionKey, args, detail, actions, size = "page", className }: StateViewProps) => {
  const { t } = useLang();
  const config = STATE_VARIANTS[variant];
  const title = fmt(t(titleKey ?? config.titleKey), ...(args ?? []));
  const descKey = descriptionKey === undefined ? config.descriptionKey : descriptionKey;
  const description = descKey ? fmt(t(descKey), ...(args ?? [])) : null;
  return (
    <div
      className={`cp-state cp-state--${size} cp-state--${variant}${className ? ` ${className}` : ""}`}
      role={config.role}
      data-state={variant}
    >
      {size !== "compact" && <GamerIllustration variant={variant} />}
      <div className="cp-state__text">
        <p className="cp-state__title">{title}</p>
        {description && <p className="cp-state__description">{description}</p>}
        {detail && <p className="cp-state__detail">{renderText(detail, t)}</p>}
      </div>
      {actions && <div className="cp-state__actions">{actions}</div>}
    </div>
  );
};

export default StateView;
