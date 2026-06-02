// "Center on my location" crosshair icon (transparent, size/colour adjustable).
import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

function LocateIcon({ size = 24, color = '#2C3333' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="12" cy="12" r="2.3" fill={color} />
      <Line x1="12" y1="1.5" x2="12" y2="4.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="19.5" x2="12" y2="22.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="1.5" y1="12" x2="4.5" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="19.5" y1="12" x2="22.5" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default React.memo(LocateIcon);
