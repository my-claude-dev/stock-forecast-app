import { ImageResponse } from "next/og";

const BACKGROUND = "#0f172a";
const FOREGROUND = "#ffffff";

// Full-bleed coordinates for standard icons vs. scaled-in coordinates that
// stay inside a maskable icon's ~80%-diameter safe zone.
const FULL_BLEED_LINE = "20,72 38,56 52,62 80,28";
const FULL_BLEED_ARROW = "80,28 68,30 78,40";
const SAFE_ZONE_LINE = "33.5,62.1 43.4,53.3 51.1,56.6 66.5,37.9";
const SAFE_ZONE_ARROW = "66.5,37.9 59.9,39 65.4,44.5";

function ChartGlyph({ size, maskable }: { size: number; maskable: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <polyline
        points={maskable ? SAFE_ZONE_LINE : FULL_BLEED_LINE}
        fill="none"
        stroke={FOREGROUND}
        strokeWidth={maskable ? 5 : 6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points={maskable ? SAFE_ZONE_ARROW : FULL_BLEED_ARROW} fill={FOREGROUND} />
    </svg>
  );
}

export function renderIcon(size: number, options: { maskable?: boolean } = {}) {
  const maskable = options.maskable ?? false;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BACKGROUND,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChartGlyph size={size} maskable={maskable} />
      </div>
    ),
    { width: size, height: size },
  );
}
