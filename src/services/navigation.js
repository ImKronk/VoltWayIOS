// Turn-by-turn navigation helpers — live progress along an ORS route.
import { haversineKm } from '../utils/geo';

function metres(a, b) {
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
}

// Maneuver arrow for an OpenRouteService step `type`.
export function maneuverIcon(type) {
  switch (type) {
    case 0: // turn left
    case 2: // sharp left
    case 4: // slight left
    case 12: // keep left
      return '↰';
    case 1: // turn right
    case 3: // sharp right
    case 5: // slight right
    case 13: // keep right
      return '↱';
    case 7: // enter roundabout
    case 8: // exit roundabout
      return '↻';
    case 9: // u-turn
      return '↶';
    case 10: // arrive
      return '⚑';
    default: // continue / depart
      return '↑';
  }
}

// Live progress given the user's current position.
// Returns { remainingDistance(m), remainingDuration(s), distanceToNext(m),
//           nextStep, arrived, offRoute }.
export function computeProgress(route, userPos) {
  const coords = route.coords || [];
  if (coords.length < 2) {
    return {
      remainingDistance: 0,
      remainingDuration: 0,
      distanceToNext: 0,
      nextStep: null,
      arrived: true,
      offRoute: false,
    };
  }

  // Nearest route coordinate to the user.
  let idx = 0;
  let nearD = Infinity;
  for (let i = 0; i < coords.length; i += 1) {
    const d = metres(coords[i], userPos);
    if (d < nearD) {
      nearD = d;
      idx = i;
    }
  }

  // Distance from the user to the end of the route.
  let remainingDistance = metres(userPos, coords[idx]);
  for (let i = idx; i < coords.length - 1; i += 1) {
    remainingDistance += metres(coords[i], coords[i + 1]);
  }

  const totalM = route.distanceM || remainingDistance || 1;
  const remainingDuration = (route.durationSec || 0) * Math.min(1, remainingDistance / totalM);

  // Next maneuver = first step whose way-point lies ahead of the user.
  const steps = route.steps || [];
  let nextStep = null;
  for (const st of steps) {
    if (st.wayPoint > idx) {
      nextStep = st;
      break;
    }
  }

  // Distance along the route until that maneuver.
  let distanceToNext = 0;
  if (nextStep) {
    distanceToNext = metres(userPos, coords[idx]);
    const target = Math.min(nextStep.wayPoint, coords.length - 1);
    for (let i = idx; i < target; i += 1) {
      distanceToNext += metres(coords[i], coords[i + 1]);
    }
  }

  return {
    remainingDistance,
    remainingDuration,
    distanceToNext,
    nextStep,
    arrived: remainingDistance < 35,
    offRoute: nearD > 70,
  };
}

// "240 m" / "1.2 km"
export function fmtDistance(m) {
  if (m == null) return '--';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// seconds -> "25 min" / "1 h 05"
export function fmtDuration(sec) {
  const min = Math.round((sec || 0) / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

// Arrival clock time (now + remaining seconds).
export function fmtEta(sec) {
  const d = new Date(Date.now() + (sec || 0) * 1000);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
