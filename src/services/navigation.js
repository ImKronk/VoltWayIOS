// Turn-by-turn navigation helpers — live progress along an ORS route.
import { haversineKm } from '../utils/geo';

function metres(a, b) {
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
}

// Linear interpolation between two coordinates (t in [0,1]).
function lerp(a, b, t) {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

// Projects point P onto segment A→B using a local equirectangular plane
// (metres). Returns { t, dist } — t is the clamped fraction along the
// segment, dist is the perpendicular distance from P to the segment.
function projectOnSegment(p, a, b) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((a.latitude * Math.PI) / 180);
  const bx = (b.longitude - a.longitude) * mPerDegLng;
  const by = (b.latitude - a.latitude) * mPerDegLat;
  const px = (p.longitude - a.longitude) * mPerDegLng;
  const py = (p.latitude - a.latitude) * mPerDegLat;
  const len2 = bx * bx + by * by;
  let t = len2 > 0 ? (px * bx + py * by) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dist = Math.hypot(px - bx * t, py - by * t);
  return { t, dist };
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

  // Snap the user onto the nearest route *segment* (not just the nearest
  // vertex) so progress stays accurate on long, sparsely-sampled stretches.
  // `seg` is the segment index i (i.e. the user sits between vertex i and
  // i+1) and `frac` is how far along that segment they are.
  let seg = 0;
  let frac = 0;
  let nearD = Infinity;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const { t, dist } = projectOnSegment(userPos, coords[i], coords[i + 1]);
    if (dist < nearD) {
      nearD = dist;
      seg = i;
      frac = t;
    }
  }

  // Exact point on the route under the user, and the next vertex ahead.
  const snapped = lerp(coords[seg], coords[seg + 1], frac);
  const nextVertex = seg + 1;

  // Distance from the snapped point to the end of the route.
  let remainingDistance = metres(snapped, coords[nextVertex]);
  for (let i = nextVertex; i < coords.length - 1; i += 1) {
    remainingDistance += metres(coords[i], coords[i + 1]);
  }

  const totalM = route.distanceM || remainingDistance || 1;
  const remainingDuration = (route.durationSec || 0) * Math.min(1, remainingDistance / totalM);

  // Next maneuver = first step whose maneuver vertex lies ahead of the user.
  // We've passed every vertex <= seg, so a maneuver at vertex w is upcoming
  // when w > seg.
  const steps = route.steps || [];
  let nextStep = null;
  for (const st of steps) {
    if (st.wayPoint > seg) {
      nextStep = st;
      break;
    }
  }

  // Distance along the route until that maneuver.
  let distanceToNext = 0;
  if (nextStep) {
    const target = Math.min(nextStep.wayPoint, coords.length - 1);
    distanceToNext = metres(snapped, coords[nextVertex]);
    for (let i = nextVertex; i < target; i += 1) {
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
