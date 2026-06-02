// Real-time traffic-aware travel time via the TomTom Routing API.
// ORS provides the route geometry/steps; TomTom provides the live ETA so the
// trip time reflects current traffic.
const TOMTOM_DEFAULT_KEY = 'Py7VtrX9fYaI36fUAvXnc789R8aL6D5V';

// waypoints: [{ lat, lng }, ...] (origin, optional charging stop, destination).
// Returns { durationSec, trafficDelaySec, freeFlowSec, distanceM } or null.
export async function tomtomTraffic(waypoints, key) {
  const k = key || TOMTOM_DEFAULT_KEY;
  if (!k || !waypoints || waypoints.length < 2) return null;
  const path = waypoints
    .filter((w) => w && w.lat != null && w.lng != null)
    .map((w) => `${w.lat},${w.lng}`)
    .join(':');
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/${path}/json` +
    `?key=${encodeURIComponent(k)}&traffic=true&travelMode=car&computeTravelTimeFor=all`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('TomTom HTTP ' + res.status);
    const data = await res.json();
    const s = data.routes && data.routes[0] && data.routes[0].summary;
    if (!s || s.travelTimeInSeconds == null) return null;
    return {
      durationSec: s.travelTimeInSeconds,
      trafficDelaySec: s.trafficDelayInSeconds || 0,
      freeFlowSec: s.noTrafficTravelTimeInSeconds || s.travelTimeInSeconds,
      distanceM: s.lengthInMeters || 0,
    };
  } catch (e) {
    console.warn('TomTom traffic unavailable:', e.message);
    return null;
  }
}
