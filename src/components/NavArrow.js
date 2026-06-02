// User-location arrow for turn-by-turn navigation (replaces the blue dot).
// A blue chevron with a white outline, pointing up — on a heading-up map that
// always means "forward".
import React from 'react';
import Svg, { Path } from 'react-native-svg';

function NavArrow({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M24 5 L41 41 L24 32 L7 41 Z"
        fill="#1A66CC"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(NavArrow);
