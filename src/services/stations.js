// Station loading: Open Charge Map (primary) + Supabase (fallback).
// Ported from loadOCMStations() / mapOCMStation() / loadStations() in app.js.
import { supabase } from '../config/supabase';

export function mapOCMStation(ocm) {
  if (!ocm || !ocm.AddressInfo) return null;
  const ai = ocm.AddressInfo;
  const conns = ocm.Connections || [];
  const maxPower = conns.reduce((m, c) => Math.max(m, c.PowerKW || 0), 0);
  const isOperational = !ocm.StatusType || ocm.StatusType.IsOperational !== false;
  const distKm = ai.Distance || 0;
  const priceMatch = (ocm.UsageCost || '').match(/(\d+[.,]\d+)/);
  // Unique connector type titles (e.g. "CCS (Type 2)", "Type 2").
  const connectorTypes = [
    ...new Set(conns.map((c) => c.ConnectionType && c.ConnectionType.Title).filter(Boolean)),
  ];
  return {
    id: ocm.ID,
    name: ai.Title || 'EV Charging Station',
    addr: [ai.AddressLine1, ai.Town].filter(Boolean).join(', ') || 'Morada indisponivel',
    operator: (ocm.OperatorInfo && ocm.OperatorInfo.Title) || null,
    connectors: connectorTypes,
    usageCostRaw: ocm.UsageCost || null,
    lat: ai.Latitude,
    lng: ai.Longitude,
    status: isOperational ? 'available' : 'unknown',
    price: priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : null,
    speed: Math.round(maxPower) || null,
    chargers: ocm.NumberOfPoints || conns.length || 1,
    dist: distKm < 1 ? Math.round(distKm * 1000) + 'm' : distKm.toFixed(1) + 'km',
    pred: 70 + Math.floor(Math.random() * 25),
    wait: 0,
  };
}

// Real EV stations near a coordinate. Returns an array or null on failure.
// NOTE: do NOT pass compact=true — it strips the Connections array, which
// the connector-aware route filter needs.
export async function loadOCMStations(lat, lng, ocmKey) {
  if (!ocmKey) {
    console.warn('OCM API key missing — skipping real station fetch.');
    return null;
  }
  try {
    const url =
      `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lng}` +
      `&distance=15&distanceunit=KM&maxresults=60&verbose=false&key=${encodeURIComponent(ocmKey)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('OCM HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Sem postos perto');
    const mapped = data.map(mapOCMStation).filter((s) => s && s.lat && s.lng);
    if (mapped.length === 0) throw new Error('Sem postos utilizaveis');
    console.log('Loaded', mapped.length, 'EV stations from Open Charge Map');
    return mapped;
  } catch (e) {
    console.warn('OCM unavailable:', e.message);
    return null;
  }
}

export async function loadSupabaseStations() {
  try {
    const { data, error } = await supabase.from('stations').select('*');
    if (error) throw error;
    return data && data.length ? data : null;
  } catch (e) {
    console.warn('Supabase stations unavailable:', e.message);
    return null;
  }
}
