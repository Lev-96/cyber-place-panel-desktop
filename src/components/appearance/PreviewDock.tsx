import AppearancePreview from "@/components/appearance/AppearancePreview";
import Button from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useRef } from "react";

/**
 * The interface preview, docked in «Карточки активных мест» (owner,
 * 2026-11-05): it sticks under the top bar for as long as that section is on
 * screen — a slider dragged below it shows its effect live — and leaves with
 * the section. «Скрыть просмотр» folds it to its head.
 *
 * It publishes its own height as `--preview-dock-h` on its section, so the
 * section's controls keep that much room above them when focus or a scroll
 * brings one into view (`scroll-margin-top`), instead of landing behind it.
 */
export const DOCK_HEIGHT_VAR = "--preview-dock-h";

interface Props {
  open: boolean;
  onToggle: () => void;
  quick: "all" | "primary";
}

const PreviewDock = ({ open, onToggle, quick }: Props) => {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dock = ref.current;
    const host = dock?.parentElement;
    if (!dock || !host || typeof ResizeObserver === "undefined") return undefined;
    const publish = () => host.style.setProperty(DOCK_HEIGHT_VAR, `${Math.round(dock.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(dock);
    return () => {
      ro.disconnect();
      host.style.removeProperty(DOCK_HEIGHT_VAR);
    };
  }, []);

  return (
    <div ref={ref} className="appearance-preview-dock" data-testid="appearance-preview-block" data-open={open ? "true" : "false"}>
      <div className="appearance-preview-dock__head">
        <span className="label">{t("appearance.preview")}</span>
        <span className="muted appearance-note">{t("appearance.previewHint")}</span>
        <Button type="button" variant="secondary" className="appearance-preview-dock__toggle"
          aria-expanded={open} onClick={onToggle} data-testid="appearance-preview-toggle">
          {open ? t("appearance.preview.hide") : t("appearance.preview.show")}
        </Button>
      </div>
      {open && (
        <div className="appearance-preview-dock__body">
          <AppearancePreview quick={quick} />
        </div>
      )}
    </div>
  );
};

export default PreviewDock;
