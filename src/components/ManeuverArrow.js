// Turn-by-turn maneuver icons — SIMPLE version (temporary).
// One straight arrow, rotated to point in the maneuver's direction.
// OpenRouteService instruction `type`:
//   0 left · 1 right · 2 sharp-left · 3 sharp-right · 4 slight-left
//   5 slight-right · 6 straight · 7 enter-roundabout · 8 exit-roundabout
//   9 u-turn · 10 arrive · 11 depart · 12 keep-left · 13 keep-right
import React from 'react';
import Svg, { G, Line, Polygon, Circle } from 'react-native-svg';

// Rotation (degrees, 0 = pointing up) for each maneuver type.
const ANGLE = {
  0: -90, // left
  1: 90, // right
  2: -135, // sharp left
  3: 135, // sharp right
  4: -45, // slight left
  5: 45, // slight right
  6: 0, // straight
  7: 0, // roundabout
  8: 0, // roundabout
  9: 180, // u-turn
  11: 0, // depart
  12: -30, // keep left
  13: 30, // keep right
};

function ManeuverArrow({ type, size = 46, color = '#fff' }) {
  // Arrival gets a simple dot rather than an arrow.
  if (type === 10) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={5} fill={color} />
      </Svg>
    );
  }

  const deg = ANGLE[type] ?? 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G origin="12, 12" rotation={deg}>
        <Line x1={12} y1={20} x2={12} y2={8} stroke={color} strokeWidth={2.8} strokeLinecap="round" />
        <Polygon points="12,4 6.5,11 17.5,11" fill={color} />
      </G>
    </Svg>
  );
}

export default React.memo(ManeuverArrow);
