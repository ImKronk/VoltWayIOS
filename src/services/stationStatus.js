// Crowd-sourced station status: charge-time estimate + report reconciliation.
//
// Goal: what the app shows must stay viable when many users report at once.
//  - The newest report sets the status (status is volatile — recency first).
//  - An "occupied" report auto-expires after the estimated charging time
//    (the car is assumed to have left) -> the station returns to available.
//  - "available" / "broken" / "unavailable" persist until a newer report
//    changes them — an out-of-service post does not fix itself.
//  - Reputation is only a mild tiebreaker for near-simultaneous conflicts.

import { EV_BATTERY_KWH } from './routing';

// Reputation tiebreak only applies to near-simultaneous conflicting reports.
const TIEBREAK_WINDOW_MIN = 3;

// Estimated minutes a car occupies a charger = time to charge 20% -> 100%
// (0.8 * 60 kWh = 48 kWh). DC charging tapers sharply above 80% and AC is
// far slower, so this is derived from the station power, not a flat 30 min.
// A ~150 kW fast charger lands near 30 min; slow AC posts take much longer.
export function estimateOccupiedMinutes(station) {
  const speedKW = station?.speed || 22; // fallback: slow AC post
  const kWh = 0.8 * EV_BATTERY_KWH; // 20% -> 100%
  const effectiveKW = speedKW * 0.65; // taper above 80% + charging losses
  const minutes = (kWh / effectiveKW) * 60;
  return Math.round(Math.min(240, Math.max(20, minutes)));
}

// Minutes until an occupied station is estimated to be free (null if not set).
export function freeInMinutes(station) {
  if (!station?.occupiedUntil) return null;
  return Math.max(0, Math.round((station.occupiedUntil - Date.now()) / 60000));
}

// Mild, secondary reputation multiplier: 1x (new user) -> 2x (1000+ pts).
function reputationWeight(points) {
  return 1 + Math.min((points || 0) / 1000, 1);
}

// Reconciles a station's crowd reports into one trustworthy status.
// `station.reports` = [{ status, at (ms epoch), points }].
// Returns { status, occupiedUntil }. `now` is injectable for testing.
export function reconcileStatus(station, now = Date.now()) {
  const reports = (station.reports || []).slice().sort((a, b) => b.at - a.at); // newest first
  if (!reports.length) {
    return { status: station.baseStatus || station.status || 'unknown', occupiedUntil: null };
  }

  // The newest report sets the state. Among reports made within a few minutes
  // of it, a more reputable user's conflicting report wins (anti-spam).
  let winner = reports[0];
  const newestAt = reports[0].at;
  for (const r of reports) {
    if (newestAt - r.at > TIEBREAK_WINDOW_MIN * 60000) break; // beyond the tiebreak window
    if (r.status !== winner.status && reputationWeight(r.points) > reputationWeight(winner.points)) {
      winner = r;
    }
  }

  // "occupied" is temporary: it only holds for the estimated charging time;
  // once that passes the car is assumed to have left -> the station is free.
  if (winner.status === 'occupied') {
    const occupiedUntil = winner.at + estimateOccupiedMinutes(station) * 60000;
    if (now >= occupiedUntil) return { status: 'available', occupiedUntil: null };
    return { status: 'occupied', occupiedUntil };
  }

  // "available" / "broken" / "unavailable" persist until a newer report
  // supersedes them — they do not expire on their own.
  return { status: winner.status, occupiedUntil: null };
}
