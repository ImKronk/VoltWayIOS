// EV-aware route planning.
// findOptimalStop() + the OpenRouteService call, ported from app.js.
import { haversineKm } from '../utils/geo';
import { stationSupportsConnector } from '../utils/connectors';
import { tomtomTraffic } from './traffic';

// Average mid-range EV. Tweak when the profile carries the real vehicle.
export const EV_FULL_RANGE_KM = 350;
export const EV_BATTERY_KWH = 60;
export const AVG_DRIVING_SPEED_KMH = 60;
export const TARGET_ARRIVAL_BUFFER_PCT = 10; // % to keep in the tank on arrival

// ─── Route-aware charging-stop selection ───
// Cumulative along-route distance (km) at each polyline vertex.
function cumulativeKm(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i += 1) {
    cum[i] =
      cum[i - 1] +
      haversineKm(
        coords[i - 1].latitude,
        coords[i - 1].longitude,
        coords[i].latitude,
        coords[i].longitude,
      );
  }
  return cum;
}

// Perpendicular distance (km) from a station to segment A→B + the clamped
// fraction t along it (local equirectangular plane — fine at these scales).
function projectKm(station, a, b) {
  const kx = 111.32 * Math.cos((a.latitude * Math.PI) / 180); // km per ° lng
  const ky = 110.57; // km per ° lat
  const bx = (b.longitude - a.longitude) * kx;
  const by = (b.latitude - a.latitude) * ky;
  const px = (station.lng - a.longitude) * kx;
  const py = (station.lat - a.latitude) * ky;
  const len2 = bx * bx + by * by;
  let t = len2 > 0 ? (px * bx + py * by) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { t, distKm: Math.hypot(px - bx * t, py - by * t) };
}

// Nearest point on the route to a station → { alongKm, offRouteKm }.
function projectOntoRoute(station, coords, cum) {
  let best = { alongKm: 0, offRouteKm: Infinity };
  for (let i = 0; i < coords.length - 1; i += 1) {
    const { t, distKm } = projectKm(station, coords[i], coords[i + 1]);
    if (distKm < best.offRouteKm) {
      best = { alongKm: cum[i] + t * (cum[i + 1] - cum[i]), offRouteKm: distKm };
    }
  }
  return best;
}

// Is the station likely to be FREE by the time we arrive (after etaMin of
// driving)? Only such stations get recommended:
//   - 'available'              -> yes (explicitly free)
//   - 'occupied'              -> only if it frees before we get there
//   - 'unknown' (no report)   -> require a high availability prediction
//   - broken / unavailable     -> never
function availableOnArrival(station, etaMin, now) {
  if (station.status === 'available') return true;
  if (station.status === 'broken' || station.status === 'unavailable') return false;
  if (station.status === 'occupied') {
    if (station.occupiedUntil) return (station.occupiedUntil - now) / 60000 <= etaMin;
    return false; // occupied with no free estimate — don't recommend
  }
  return (station.pred || 0) >= 65; // unknown — high probability of being free
}

// Chooses the charging stop for a route, scored by the REAL on-route detour
// (projection onto the actual ORS geometry) + charge time — so a station on
// the motorway the route already uses beats a closer off-route one.
//   - reachable safely       -> most efficient among them ("Equilíbrio")
//   - none reachable safely  -> emergency: nearest available (may dip < min)
//   - no compatible station  -> noOption
export function analyzeRouteStop(directRoute, opts) {
  const { stations, batteryPrefs, userConnector } = opts;
  const { currentBatt, minBatt, maxDist } = batteryPrefs;
  const coords = directRoute.coords || [];
  const cum = cumulativeKm(coords);
  const totalRouteKm = cum[cum.length - 1] || (directRoute.distanceM || 0) / 1000;
  const availableRangeKm = Math.min(((currentBatt - minBatt) / 100) * EV_FULL_RANGE_KM, maxDist);

  if (totalRouteKm <= availableRangeKm) {
    return { needsStop: false, totalRouteKm, availableRangeKm, currentBatt, minBatt };
  }

  const now = Date.now();
  const scored = [];
  for (const s of stations) {
    if (!stationSupportsConnector(s, userConnector)) continue;
    if (s.status === 'broken' || s.status === 'unavailable') continue;

    const proj = projectOntoRoute(s, coords, cum);
    const distToStop = proj.alongKm + proj.offRouteKm; // drive to reach it
    const distStopToDest = totalRouteKm - proj.alongKm + proj.offRouteKm;
    const detourKm = distToStop + distStopToDest - totalRouteKm; // ≈ 2×off-route
    const arrivalBatt = currentBatt - (distToStop / EV_FULL_RANGE_KM) * 100;
    const reachable = arrivalBatt >= minBatt && distToStop <= maxDist;
    const etaToStopMin = (distToStop / AVG_DRIVING_SPEED_KMH) * 60;
    const availOnArrival = availableOnArrival(s, etaToStopMin, now);
    const speed = s.speed || 22;
    const kWhNeeded =
      (distStopToDest / EV_FULL_RANGE_KM + TARGET_ARRIVAL_BUFFER_PCT / 100) * EV_BATTERY_KWH;
    const chargeMin = (kWhNeeded / speed) * 60;
    const driveMin = ((totalRouteKm + detourKm) / AVG_DRIVING_SPEED_KMH) * 60;
    const occupiedPenaltyMin = s.status === 'occupied' ? 15 : 0;

    scored.push({
      station: s,
      alongKm: +proj.alongKm.toFixed(1),
      offRouteKm: +proj.offRouteKm.toFixed(2),
      distToStop: +distToStop.toFixed(1),
      distStopToDest: +distStopToDest.toFixed(1),
      detourKm: +detourKm.toFixed(1),
      availOnArrival,
      arrivalBatt: Math.round(arrivalBatt),
      kWhNeeded: Math.round(kWhNeeded),
      chargeMin: Math.round(chargeMin),
      driveMin: Math.round(driveMin),
      totalTripMin: Math.round(chargeMin + driveMin + occupiedPenaltyMin),
      occupiedPenaltyMin,
      reachable,
    });
  }

  if (!scored.length) {
    return { needsStop: true, noOption: true, totalRouteKm, availableRangeKm, currentBatt, minBatt };
  }

  // Only recommend stations that are free (or very likely free) on arrival.
  // If none qualify, fall back to all of them as a last resort.
  const recommendable = scored.filter((c) => c.availOnArrival);
  const pool = recommendable.length ? recommendable : scored;

  // Equilíbrio: the most efficient stop AMONG the safely-reachable ones.
  const reachable = pool.filter((c) => c.reachable);
  if (reachable.length) {
    reachable.sort((a, b) => a.totalTripMin - b.totalTripMin);
    const best = reachable[0];
    // The most efficient stop OVERALL. If it's a different station that dips
    // below the min limit, expose it as a riskier "second best" the user can
    // pick (e.g. the motorway charger you can't quite reach safely).
    const efficientOverall = [...pool].sort((a, b) => a.totalTripMin - b.totalTripMin)[0];
    let riskyStop = null;
    if (
      efficientOverall &&
      !efficientOverall.reachable &&
      efficientOverall.station.id !== best.station.id
    ) {
      riskyStop = {
        ...efficientOverall,
        belowMinBy: Math.max(0, Math.round(minBatt - efficientOverall.arrivalBatt)),
      };
    }
    return {
      needsStop: true,
      totalRouteKm,
      availableRangeKm,
      currentBatt,
      minBatt,
      best,
      alternatives: reachable.slice(1, 3),
      riskyStop,
      noneAvailable: recommendable.length === 0,
      considered: reachable.length,
    };
  }

  // Nothing reachable above the min → emergency: nearest available on the way.
  const availRank = (st) => (st.status === 'available' ? 0 : st.status === 'occupied' ? 2 : 1);
  pool.sort((a, b) => availRank(a.station) - availRank(b.station) || a.distToStop - b.distToStop);
  const best = { ...pool[0], belowMinBy: Math.max(0, Math.round(minBatt - pool[0].arrivalBatt)) };
  return {
    needsStop: true,
    emergency: true,
    totalRouteKm,
    availableRangeKm,
    currentBatt,
    minBatt,
    best,
    alternatives: pool.slice(1, 3),
    noneAvailable: recommendable.length === 0,
    considered: pool.length,
  };
}

// Maps one ORS GeoJSON feature into a map-ready route option: polyline
// coords, summary text, turn-by-turn steps, main road name, and toll info.
function mapFeatureToRoute(feature) {
  const coords = feature.geometry.coordinates.map((c) => ({ latitude: c[1], longitude: c[0] }));
  const summary = feature.properties.summary || {};
  const distM = summary.distance || 0;
  const distKm = distM / 1000;
  const distanceText = distKm < 10 ? distKm.toFixed(1) + ' km' : Math.round(distKm) + ' km';
  const totalMin = Math.round((summary.duration || 0) / 60);
  const durationText =
    totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}min` : `${totalMin} min`;

  // Flatten turn-by-turn steps; also pick the main road (longest named step).
  const steps = [];
  let roadName = '';
  let roadDist = 0;
  for (const seg of feature.properties.segments || []) {
    for (const st of seg.steps || []) {
      const name = st.name && st.name !== '-' ? st.name : '';
      steps.push({
        instruction: st.instruction,
        name,
        distance: st.distance,
        type: st.type,
        wayPoint: st.way_points ? st.way_points[0] : 0,
      });
      if (name && st.distance > roadDist) {
        roadDist = st.distance;
        roadName = name;
      }
    }
  }

  // Toll distance from the `tollways` extra (value 1 = tollway segment).
  let tollDistanceM = 0;
  const tw = feature.properties.extras && feature.properties.extras.tollways;
  if (tw && Array.isArray(tw.summary)) {
    for (const row of tw.summary) {
      if (row.value === 1) tollDistanceM += row.distance || 0;
    }
  }

  return {
    coords,
    distanceText,
    durationText,
    distanceKm: distKm,
    distanceM: distM,
    durationSec: summary.duration || 0,
    steps,
    roadName,
    hasTolls: tollDistanceM > 5,
    tollDistanceM,
    tollPrice: null, // filled later by the tolls service when a key is set
  };
}

// Calls OpenRouteService and returns one or more route options. `waypoints`
// is an array of [lng, lat] pairs. opts:
//   avoid        — ['tollways' | 'highways' | 'ferries'] (Evitar)
//   alternatives — request up to 3 alternative routes (2-point routes only)
export async function fetchRoutes(waypoints, orsKey, opts = {}) {
  const { avoid = [], alternatives = false } = opts;
  const body = {
    coordinates: waypoints,
    language: 'pt',
    instructions: true,
    extra_info: ['tollways'],
  };
  if (avoid.length) body.options = { avoid_features: avoid };
  // ORS only allows alternative_routes for exactly two coordinates.
  if (alternatives && waypoints.length === 2) {
    body.alternative_routes = { target_count: 3, weight_factor: 1.6, share_factor: 0.6 };
  }

  const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
    method: 'POST',
    headers: {
      Authorization: orsKey,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('ORS HTTP ' + res.status + ' — ' + t.slice(0, 90));
  }
  const data = await res.json();
  const feats = data.features || [];
  if (!feats.length) throw new Error('Sem rota devolvida');
  return feats.map(mapFeatureToRoute);
}

// One-shot helper used by both the map search and the route screen.
// Returns { ok:true, route, routeOptions } or { ok:false, error }.
//   route        — the selected (first) option
//   routeOptions — all options (alternatives), each a full route object
// opts.avoid is the Evitar selection (['tollways','highways','ferries']).
export async function planRoute(destination, opts) {
  const { stations, origin, batteryPrefs, userConnector, orsKey, avoid = [], tomtomKey } = opts;

  if (!orsKey) {
    return { ok: false, error: 'Chave OpenRouteService nao configurada.' };
  }

  // 1. Direct route first — its real geometry drives both the on-route charging
  //    analysis and the alternative options.
  let directOptions;
  try {
    directOptions = await fetchRoutes(
      [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
      orsKey,
      { avoid, alternatives: true },
    );
  } catch (e) {
    return { ok: false, error: 'Nao foi possivel calcular a rota: ' + e.message };
  }

  // 2. Pick the charging stop using the ACTUAL route (projection-based detour).
  const analysis = analyzeRouteStop(directOptions[0], { stations, batteryPrefs, userConnector });

  if (analysis.needsStop && analysis.noOption) {
    return {
      ok: false,
      error:
        `Bateria insuficiente: rota ~${Math.round(analysis.totalRouteKm)} km, ` +
        `alcance disponivel ~${Math.round(analysis.availableRangeKm)} km. ` +
        'Nenhum posto compativel encontrado.',
    };
  }

  // 3. Final options: re-route through the stop, or keep the direct alternatives.
  const stopStation = analysis.needsStop ? analysis.best.station : null;
  let routeOptions;
  if (stopStation) {
    try {
      const via = await fetchRoutes(
        [
          [origin.lng, origin.lat],
          [stopStation.lng, stopStation.lat],
          [destination.lng, destination.lat],
        ],
        orsKey,
        { avoid, alternatives: false },
      );
      routeOptions = via.map((o) => ({ destination, analysis, stopStation, ...o }));
    } catch (e) {
      return { ok: false, error: 'Nao foi possivel calcular a rota: ' + e.message };
    }
  } else {
    routeOptions = directOptions.map((o) => ({ destination, analysis, stopStation: null, ...o }));
  }

  // 3b. Offer a riskier "second best" route through the most efficient stop
  //     that dips below the minimum battery — selectable, with a warning.
  if (analysis.riskyStop) {
    try {
      const rs = analysis.riskyStop.station;
      const viaRisky = await fetchRoutes(
        [
          [origin.lng, origin.lat],
          [rs.lng, rs.lat],
          [destination.lng, destination.lat],
        ],
        orsKey,
        { avoid, alternatives: false },
      );
      const riskyOpts = viaRisky.map((o) => ({
        destination,
        analysis,
        stopStation: rs,
        belowMin: true,
        stopArrivalBatt: analysis.riskyStop.arrivalBatt,
        belowMinBy: analysis.riskyStop.belowMinBy,
        ...o,
      }));
      routeOptions = [...routeOptions, ...riskyOpts];
    } catch (e) {
      // keep the safe route only
    }
  }

  // 4. Real-time traffic (TomTom): refine the ETA of the selected route.
  try {
    const wp = stopStation
      ? [
          { lat: origin.lat, lng: origin.lng },
          { lat: stopStation.lat, lng: stopStation.lng },
          { lat: destination.lat, lng: destination.lng },
        ]
      : [
          { lat: origin.lat, lng: origin.lng },
          { lat: destination.lat, lng: destination.lng },
        ];
    const traffic = await tomtomTraffic(wp, tomtomKey);
    if (traffic && traffic.durationSec) {
      const base = routeOptions[0].durationSec || traffic.durationSec;
      const factor = base > 0 ? traffic.durationSec / base : 1;
      for (const o of routeOptions) {
        o.freeFlowSec = o.durationSec;
        o.durationSec = Math.round((o.durationSec || base) * factor);
        const min = Math.round(o.durationSec / 60);
        o.durationText = min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min} min`;
        o.trafficDelaySec = traffic.trafficDelaySec;
        o.trafficLevel =
          traffic.trafficDelaySec > 300 ? 'heavy' : traffic.trafficDelaySec > 60 ? 'moderate' : 'light';
      }
    }
  } catch (e) {
    // traffic is best-effort — keep the ORS times on failure
  }

  return { ok: true, route: routeOptions[0], routeOptions };
}
