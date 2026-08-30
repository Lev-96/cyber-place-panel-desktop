import { useId, useMemo } from "react";

export interface TrendSeries {
  /** Series name, shown in the legend and in the accessible summary. */
  name: string;
  /** One value per point, positionally aligned with `labels`. */
  values: number[];
  color: string;
}

interface Props {
  /** X-axis labels, already formatted for display by the caller. */
  labels: string[];
  series: TrendSeries[];
  /** Drawing height in px. Width is fluid — the chart scales to its container. */
  height?: number;
}

/** Internal drawing box. Rendered through a fluid viewBox, so these are ratios. */
const VIEW_W = 1000;
const PAD_X = 8;
const PAD_Y = 10;

/**
 * Dependency-free line chart for a small time series.
 *
 * Deliberately hand-rolled SVG rather than a charting library: the panel ships
 * as an Electron bundle and this needs one polyline plus a gradient fill —
 * pulling in a chart dependency for that would cost far more than it saves.
 * Kept generic (labels + named series) so any other screen with a daily curve
 * can reuse it.
 *
 * ## Rendering rules
 * - Scales to the max across ALL series, so two series stay comparable rather
 *   than each being normalised to its own peak (which would make a small series
 *   look identical to a large one).
 * - A flat series — every value equal, including all-zero — is drawn along the
 *   baseline instead of dividing by a zero range.
 * - Fewer than two points cannot form a line, so the chart yields to the
 *   caller's empty state.
 */
const TrendChart = ({ labels, series, height = 180 }: Props) => {
  const gradientId = useId();

  const geometry = useMemo(() => {
    const count = labels.length;
    if (count < 2) return null;

    const max = Math.max(0, ...series.flatMap((s) => s.values));
    // All-zero (or flat) data has no range to scale against — pin it to the
    // baseline rather than dividing by zero.
    const scale = max > 0 ? max : 1;
    const stepX = (VIEW_W - PAD_X * 2) / (count - 1);
    const usableY = height - PAD_Y * 2;

    const pointsFor = (values: number[]) =>
      labels.map((_, i) => {
        const value = values[i] ?? 0;
        const x = PAD_X + i * stepX;
        const y = PAD_Y + usableY - (value / scale) * usableY;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });

    return { max, pointsFor, baseline: PAD_Y + usableY };
  }, [labels, series, height]);

  if (!geometry) return null;

  const [primary] = series;
  const primaryPoints = geometry.pointsFor(primary.values);

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        role="img"
        aria-label={series
          .map((s) => `${s.name}: ${s.values.reduce((a, b) => a + b, 0)}`)
          .join(", ")}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={primary.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Filled area under the first series only — stacking translucent
            fills for every series turns the plot into mud. */}
        <polygon
          points={`${PAD_X},${geometry.baseline} ${primaryPoints.join(" ")} ${VIEW_W - PAD_X},${geometry.baseline}`}
          fill={`url(#${gradientId})`}
        />

        {series.map((s) => (
          <polyline
            key={s.name}
            points={geometry.pointsFor(s.values).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            // The viewBox is stretched horizontally (preserveAspectRatio
            // none), which would smear the stroke width with it.
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <figcaption
        className="row"
        style={{ justifyContent: "space-between", gap: 12, marginTop: 6 }}
      >
        <span className="muted" style={{ fontSize: 11 }}>{labels[0]}</span>
        <span className="row" style={{ gap: 12 }}>
          {series.map((s) => (
            <span key={s.name} className="muted" style={{ fontSize: 11 }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: s.color,
                  marginRight: 5,
                }}
              />
              {s.name}
            </span>
          ))}
        </span>
        <span className="muted" style={{ fontSize: 11 }}>{labels[labels.length - 1]}</span>
      </figcaption>
    </figure>
  );
};

export default TrendChart;
