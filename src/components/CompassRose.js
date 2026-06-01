// North-arrow compass indicator (styled after the classic two-tone north
// arrow). Rotates by `-heading` so the arrow + "N" always point to true
// north as the map camera rotates with the phone's compass heading.
import React from 'react';
import Svg, { G, Polygon, Text as SvgText } from 'react-native-svg';

function CompassRose({ heading = 0, size = 30, color = '#1B2838' }) {
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 44 56">
      <G origin="22, 26" rotation={-heading}>
        {/* left half — outlined */}
        <Polygon
          points="22,4 8,42 22,32"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* right half — solid */}
        <Polygon points="22,4 36,42 22,32" fill={color} />
        {/* north label */}
        <SvgText x="22" y="54" fontSize="14" fontWeight="bold" fill={color} textAnchor="middle">
          N
        </SvgText>
      </G>
    </Svg>
  );
}

export default React.memo(CompassRose);
