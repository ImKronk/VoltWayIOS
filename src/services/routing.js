// EV-aware route planning.
// findOptimalStop() + the OpenRouteService call, ported from app.js.
import { haversineKm } from '../utils/geo';
import { stationSupportsConnector } from '../utils/connectors';

// Average mid-range EV. Tweak when the profile carries the real vehicle.
export const EV_FULL_RANGE_KM = 350;
export const EV_BATTERY_KWH = 60;
export const AVG_DRIVING_SPEED_KMH = 60;
export const TARGET_ARRIVAL_BUFFER_PCT = 10; // % to keep in the tank on arrival

// Returns the most efficient charging stop between `origin` and `destination`.
// "Efficient" = minimum total trip time (drive + charge + occupied penalty),
// subject to: connector compatible, reachable on current battery, not broken.
//   - destination reachable directly  -> { needsStop:false }
//   - a stop is reachable             -> { needsStop:true, best, alternatives }
//   - nothing reachable safely        -> { needsStop:true, emergency:true, ... }
//   - no compatible station at all    -> { needsStop:true, noOption:true }
export function findOptimalStop(destination, opts) {
  const { stations, origin, batteryPrefs, userConnector } = opts;
  const { currentBatt, minBatt, maxDist } = batteryPrefs;

  const totalRouteKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const availableRangeKm = Math.min(
    ((currentBatt - minBatt) / 100) * EV_FULL_RANGE_KM,
    maxDist,
  );

  if (totalRouteKm <= availableRangeKm) {
    return { needsStop: false, totalRouteKm, availableRangeKm, currentBatt, minBatt };
  }

  const candidates = [];
  for (const s of stations) {
    if (!stationSupportsConnector(s, userConnector)) continue;
    if (s.status === 'broken' || s.status === 'unavailable') continue;

    const distToStop = haversineKm(origin.lat, origin.lng, s.lat, s.lng);
    const arrivalBatt = currentBatt - (distToStop / EV_FULL_RANGE_KM) * 100;
    if (arrivalBatt < minBatt) continue; // would dip below min on the way
    if (distToStop > maxDist) continue; // exceeds the user's per-leg cap

    const distStopToDest = haversineKm(s.lat, s.lng, destination.lat, destination.lng);
    const speed = s.speed || 22;
    const kWhNeeded =
      (distStopToDest / EV_FULL_RANGE_KM + TARGET_ARRIVAL_BUFFER_PCT / 100) * EV_BATTERY_KWH;
    const chargeMin = (kWhNeeded / speed) * 60;
    const driveMin = ((distToStop + distStopToDest) / AVG_DRIVING_SPEED_KMH) * 60;
    const occupiedPenaltyMin = s.status === 'occupied' ? 15 : 0;
    const totalTripMin = chargeMin + driveMin + occupiedPenaltyMin;

    candidates.push({
      station: s,
      distToStop: +distToStop.toFixed(1),
      distStopToDest: +distStopToDest.toFixed(1),
      detourKm: +(distToStop + distStopToDest - totalRouteKm).toFixed(1),
      arrivalBatt: Math.round(arrivalBatt),
      kWhNeeded: Math.round(kWhNeeded),
      chargeMin: Math.round(chargeMin),
      driveMin: Math.round(driveMin),
      totalTripMin: Math.round(totalTripMin),
      occupiedPenaltyMin,
    });
  }

  if (!candidates.length) {
    // Emergency fallback — pick the closest compatible non-broken station
    // even though the car will likely dip below the min-battery limit.
    const fallback = [];
    for (const s of stations) {
      if (!stationSupportsConnector(s, userConnector)) continue;
      if (s.status === 'broken' || s.status === 'unavailable') continue;
      const distToStop = haversineKm(origin.lat, origin.lng, s.lat, s.lng);
      const distStopToDest = haversineKm(s.lat, s.lng, destination.lat, destination.lng);
      const arrivalBatt = currentBatt - (distToStop / EV_FULL_RANGE_KM) * 100;
      const speed = s.speed || 22;
      const kWhNeeded =
        (distStopToDest / EV_FULL_RANGE_KM + TARGET_ARRIVAL_BUFFER_PCT / 100) * EV_BATTERY_KWH;
      fallback.push({
        station: s,
        distToStop: +distToStop.toFixed(1),
        distStopToDest: +distStopToDest.toFixed(1),
        detourKm: +(distToStop + distStopToDest - totalRouteKm).toFixed(1),
        arrivalBatt: Math.round(arrivalBatt),
        kWhNeeded: Math.round(kWhNeeded),
        chargeMin: Math.round((kWhNeeded / speed) * 60),
        driveMin: Math.round(((distToStop + distStopToDest) / AVG_DRIVING_SPEED_KMH) * 60),
        totalTripMin: 0,
        occupiedPenaltyMin: s.status === 'occupied' ? 15 : 0,
        belowMinBy: Math.max(0, Math.round(minBatt - arrivalBatt)),
      });
    }
    if (!fallback.length) {
      return { needsStop: true, noOption: true, totalRouteKm, availableRangeKm, currentBatt, minBatt };
    }
    fallback.sort((a, b) => a.distToStop - b.distToStop);
    return {
      needsStop: true,
      emergency: true,
      totalRouteKm,
      availableRangeKm,
      currentBatt,
      minBatt,
      best: fallback[0],
      alternatives: fallback.slice(1, 3),
      considered: fallback.length,
    };
  }

  candidates.sort((a, b) => a.totalTripMin - b.totalTripMin);
  return {
    needsStop: true,
    totalRouteKm,
    availableRangeKm,
    currentBatt,
    minBatt,
    best: candidates[0],
    alternatives: candidates.slice(1, 3),
    considered: candidates.length,
  };
}

// Calls OpenRouteService and returns map-ready polyline coords + summary +
// turn-by-turn steps. `waypoints` is an array of [lng, lat] pairs.
export async function fetchRoute(waypoints, orsKey) {
  const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
    method: 'POST',
    headers: {
      Authorization: orsKey,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    },
    body: JSON.stringify({ coordinates: waypoints, language: 'pt', instructions: true }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('ORS HTTP ' + res.status + ' — ' + t.slice(0, 90));
  }
  const data = await res.json();
  const feature = data.features && data.features[0];
  if (!feature) throw new Error('Sem rota devolvida');

  const coords = feature.geometry.coordinates.map((c) => ({ latitude: c[1], longitude: c[0] }));
  const summary = feature.properties.summary;
  const distKm = summary.distance / 1000;
  const distanceText = distKm < 10 ? distKm.toFixed(1) + ' km' : Math.round(distKm) + ' km';
  const totalMin = Math.round(summary.duration / 60);
  const durationText =
    totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}min` : `${totalMin} min`;

  // Flatten turn-by-turn steps from every segment (way_points index `coords`).
  const steps = [];
  for (const seg of feature.properties.segments || []) {
    for (const st of seg.steps || []) {
      steps.push({
        instruction: st.instruction,
        name: st.name && st.name !== '-' ? st.name : '',
        distance: st.distance,
        type: st.type,
        wayPoint: st.way_points ? st.way_points[0] : 0,
      });
    }
  }

  return {
    coords,
    distanceText,
    durationText,
    distanceKm: distKm,
    distanceM: summary.distance,
    durationSec: summary.duration,
    steps,
  };
}

// One-shot helper used by both the map search and the route screen.
// Returns { ok:true, route } or { ok:false, error }.
export async function planRoute(destination, opts) {
  const { stations, origin, batteryPrefs, userConnector, orsKey } = opts;

  if (!orsKey) {
    return { ok: false, error: 'Chave OpenRouteService nao configurada.' };
  }

  const analysis = findOptimalStop(destination, { stations, origin, batteryPrefs, userConnector });

  if (analysis.needsStop && analysis.noOption) {
    return {
      ok: false,
      error:
        `Bateria insuficiente: rota ~${Math.round(analysis.totalRouteKm)} km, ` +
        `alcance disponivel ~${Math.round(analysis.availableRangeKm)} km. ` +
        'Nenhum posto compativel encontrado.',
    };
  }

  let waypoints = [
    [origin.lng, origin.lat],
    [destination.lng, destination.lat],
  ];
  let stopStation = null;
  if (analysis.needsStop) {
    stopStation = analysis.best.station;
    waypoints = [
      [origin.lng, origin.lat],
      [stopStation.lng, stopStation.lat],
      [destination.lng, destination.lat],
    ];
  }

  try {
    const r = await fetchRoute(waypoints, orsKey);
    return { ok: true, route: { destination, analysis, stopStation, ...r } };
  } catch (e) {
    return { ok: false, error: 'Nao foi possivel calcular a rota: ' + e.message };
  }
}
