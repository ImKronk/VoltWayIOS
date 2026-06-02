// Destination map marker — a round red pushpin. The artwork sits in the TOP
// half of the canvas with the stem TIP at the vertical centre, and the bottom
// half is transparent. Anchoring the marker at its centre ({0.5, 0.5}) then
// puts the tip exactly on the destination coordinate — reliable even when
// react-native-maps doesn't honour a {0.5, 1} anchor for custom SVG markers.
import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

function DestinationPin({ size = 42 }) {
  const w = size;
  const h = size * 3; // viewBox 40x120 → tip (y=60) is the vertical centre
  return (
    <Svg width={w} height={h} viewBox="0 0 40 120">
      {/* stem — ends at y=60 (the canvas centre) = the marker's anchor point */}
      <Line x1="20" y1="28" x2="20" y2="60" stroke="#5B5B5B" strokeWidth="2.6" strokeLinecap="butt" />
      {/* head */}
      <Circle cx="20" cy="16" r="14" fill="#EF4136" />
      {/* highlight */}
      <Circle cx="26" cy="10" r="4" fill="#F9A39C" />
    </Svg>
  );
}

export default React.memo(DestinationPin);
