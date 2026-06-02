// Charging-station map marker — the golden lightning bolt (smooth, no pixel
// effect). Transparent background, size-adjustable. The bolt's bottom tip is
// near the bottom of the viewBox so the marker anchors {x:0.5, y:0.977} onto
// the station's exact coordinate.
import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const BOLT = 'M40 5 L15 47 L27 47 L28 86 L44 40 L32 40 Z';

function StationIcon({ size = 30, color }) {
  const w = size;
  const h = size * 1.55;

  // Solid colour variant (e.g. the selected charging stop) — keeps the same
  // shape/anchor, just a different fill with a subtle outline.
  if (color) {
    return (
      <Svg width={w} height={h} viewBox="0 0 56 88">
        <Path
          d={BOLT}
          fill={color}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  // Default golden bolt (all other stations) — unchanged.
  return (
    <Svg width={w} height={h} viewBox="0 0 56 88">
      <Defs>
        <LinearGradient id="boltGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD21E" />
          <Stop offset="1" stopColor="#F0A500" />
        </LinearGradient>
      </Defs>
      <Path
        d={BOLT}
        fill="url(#boltGrad)"
        stroke="#E09400"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default React.memo(StationIcon);
