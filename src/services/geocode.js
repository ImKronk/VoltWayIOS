// Address autocomplete via OpenRouteService geocoding (Pelias-powered).
// Reuses the ORS API key already loaded from Supabase — no extra provider.

// Returns up to 6 address suggestions: [{ name, lat, lng }].
export async function autocompleteAddress(query, orsKey, focus) {
  const text = (query || '').trim();
  if (!orsKey || text.length < 3) return [];
  try {
    const params = new URLSearchParams({ api_key: orsKey, text, size: '6' });
    // Bias results towards the user's current location.
    if (focus && focus.lat != null && focus.lng != null) {
      params.set('focus.point.lon', String(focus.lng));
      params.set('focus.point.lat', String(focus.lat));
    }
    const res = await fetch(
      `https://api.openrouteservice.org/geocode/autocomplete?${params.toString()}`,
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return (data.features || [])
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((f) => ({
        name: f.properties?.label || f.properties?.name || 'Local',
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
  } catch (e) {
    console.warn('autocompleteAddress:', e.message);
    return [];
  }
}
