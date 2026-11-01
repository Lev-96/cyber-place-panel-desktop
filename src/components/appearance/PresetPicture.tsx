import type { InterfaceId } from "@/preferences/uiPreferences";

/**
 * A miniature of each ready-made interface (2026-10-27): what one place
 * looks like in it, drawn at a fixed scale so the four pictures can be
 * compared side by side whatever interface is on now. A picture only —
 * no text to read, nothing to press.
 */
const PresetPicture = ({ id }: { id: InterfaceId }) => {
  if (id === "simple") {
    return (
      <span className="preset-pic preset-pic--simple" aria-hidden>
        <span className="pp-card">
          <span className="pp-chip" />
          <span className="pp-title pp-title--big" />
          <span className="pp-timer pp-timer--big" />
          <span className="pp-btn pp-btn--big" />
          <span className="pp-btn pp-btn--big pp-btn--stop" />
        </span>
      </span>
    );
  }
  if (id === "compact") {
    return (
      <span className="preset-pic preset-pic--compact" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="pp-row">
            <span className="pp-dot" />
            <span className="pp-title" />
            <span className="pp-timer" />
            <span className="pp-mini" /><span className="pp-mini" /><span className="pp-mini pp-btn--stop" />
          </span>
        ))}
      </span>
    );
  }
  if (id === "custom") {
    return (
      <span className="preset-pic preset-pic--custom" aria-hidden>
        <span className="pp-slider"><span style={{ width: "70%" }} /></span>
        <span className="pp-slider"><span style={{ width: "40%" }} /></span>
        <span className="pp-slider"><span style={{ width: "85%" }} /></span>
      </span>
    );
  }
  return (
    <span className="preset-pic preset-pic--standard" aria-hidden>
      {[0, 1].map((i) => (
        <span key={i} className="pp-card">
          <span className="pp-title" />
          <span className="pp-timer" />
          <span className="pp-grid"><span className="pp-btn" /><span className="pp-btn" /><span className="pp-btn" /><span className="pp-btn pp-btn--stop" /></span>
        </span>
      ))}
    </span>
  );
};

export default PresetPicture;
