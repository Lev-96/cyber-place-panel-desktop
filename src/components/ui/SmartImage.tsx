import { CSSProperties, useEffect, useState } from "react";

interface Props {
  src: string | null | undefined;
  /** Used to render the placeholder letter when src is empty / fails to load. */
  name?: string;
  alt?: string;
  size?: number | string;
  /** "circle" or "square" with rounded corners. Default "square". */
  shape?: "circle" | "square";
  /** Extra container style. */
  style?: CSSProperties;
}

/**
 * Image with skeleton-shimmer while loading and first-letter fallback when
 * src is missing or fails to load. Used everywhere we display logos/avatars.
 */
const SmartImage = ({ src, name, alt, size, shape = "square", style }: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const radius = shape === "circle" ? "50%" : "10px";
  const letter = (name ?? "?").trim().charAt(0).toUpperCase() || "?";

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src]);

  const showLetter = !src || errored;

  const containerStyle: CSSProperties = {
    width: size, height: size, borderRadius: radius,
    background: "#0b1224", border: "1px solid #1f2a44",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", flexShrink: 0, position: "relative",
    ...style,
  };

  if (showLetter) {
    return (
      <div style={containerStyle}>
        <span style={{
          color: "#07ddf1", fontWeight: 700,
          fontSize: typeof size === "number" ? Math.round(size * 0.42) : "1.2em",
          fontFamily: "'Playstation', 'Inter', sans-serif",
          letterSpacing: 1,
        }}>
          {letter}
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle} className={loaded ? undefined : "cp-skeleton"}>
      <img
        src={src!}
        alt={alt ?? name ?? ""}
        loading="lazy"
        decoding="async"
        className={`cp-img-fade ${loaded ? "loaded" : ""}`}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
};

export default SmartImage;
