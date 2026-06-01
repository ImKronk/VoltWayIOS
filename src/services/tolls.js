// Toll PRICE estimation via the TollGuru API (optional, external).
//
// OpenRouteService tells us WHERE the tollways are (distance) but not the
// price. TollGuru turns a route polyline into a toll cost, including for
// Portugal. This service is ready to use but inert until you provide a key.
//
// ── How to enable (do this once you have a TollGuru key) ───────────────────
// 1. Create a free key at https://tollguru.com/developers (free tier covers
//    a few thousand calls/month).
// 2. Store it in Supabase `app_config` as key `tollguru_api_key`, and add
//    'tollguru_api_key' to the `.in([...])` filter in services/appConfig.js
//    so `keys.tollguru` gets loaded (mirrors ocm/ors).
// 3. In state/AppContext.js, after a successful planRoute, enrich the options:
//        import { enrichRoutesWithTolls } from '../services/tolls';
//        if (keys.tollguru) {
//          const withTolls = await enrichRoutesWithTolls(res.routeOptions, keys.tollguru);
//          setRouteOptions(withTolls); setRoute(withTolls[0]);
//        }
// The UI already shows `route.tollPrice` as "Taxa X,XX €" when present, and
// falls back to ORS toll-distance detection ("Com portagens · N km") when not.

// Google-style polyline encoding (precision 5) for a [{latitude,longitude}] list.
function encodePolyline(coords) {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  const enc = (v) => {
    let s = v < 0 ? ~(v << 1) : v << 1;
    let chunk = '';
    while (s >= 0x20) {
      chunk += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
      s >>= 5;
    }
    chunk += String.fromCharCode(s + 63);
    return chunk;
  };
  for (const c of coords) {
    const lat = Math.round(c.latitude * 1e5);
    const lng = Math.round(c.longitude * 1e5);
    out += enc(lat - lastLat) + enc(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

// Returns the toll cost (number, in the route's currency) for one route, or
// null on any failure. Defensive about TollGuru's response shape.
export async function fetchTollPrice(coords, key, vehicleType = '2AxlesAuto') {
  if (!key || !coords || coords.length < 2) return null;
  try {
    const res = await fetch(
      'https://apis.tollguru.com/toll/v2/complete-polyline-from-mapping-service',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({
          source: 'google',
          polyline: encodePolyline(coords),
          vehicleType,
          vehicle: { type: vehicleType },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.route || (Array.isArray(data.routes) ? data.routes[0] : null);
    const costs = route?.costs || data.costs || {};
    const price =
      costs.minimumTollCost ?? costs.tag ?? costs.cash ?? costs.licensePlate ?? null;
    return typeof price === 'number' ? price : null;
  } catch (e) {
    return null;
  }
}

// Enriches each route option with `tollPrice` (in parallel). Options without
// tollways are left as-is. Never throws — failures leave tollPrice null.
export async function enrichRoutesWithTolls(routeOptions, key, vehicleType) {
  if (!key) return routeOptions;
  return Promise.all(
    routeOptions.map(async (opt) => {
      if (!opt.hasTolls) return opt;
      const tollPrice = await fetchTollPrice(opt.coords, key, vehicleType);
      return tollPrice != null ? { ...opt, tollPrice } : opt;
    }),
  );
}
