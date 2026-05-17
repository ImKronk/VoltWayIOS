// Community status reports — Supabase persistence + realtime feed.
// Reporting an Open Charge Map station needs the online setup SQL run once
// (see supabase-online-setup.sql); until then reports stay local only.
import { supabase } from '../config/supabase';

// Maps a Supabase `reports` row to the local shape used by reconcileStatus():
// { status, at (ms epoch), points }.
export function mapReportRow(row) {
  return {
    status: row.status,
    at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    points: row.reporter_points || 0,
  };
}

// Inserts a community report. Falls back gracefully (local only) if the
// online setup has not been applied yet.
export async function submitReport(stationId, status, user) {
  try {
    const { error } = await supabase.from('reports').insert({
      station_id: stationId,
      user_id: user ? user.id : null,
      user_name: user ? user.user_metadata?.name || user.email?.split('@')[0] : 'Anónimo',
      status,
      reporter_points: user?.user_metadata?.points || 0,
    });
    if (error) throw error;
    return { ok: true, persisted: true };
  } catch (e) {
    console.warn('Report kept local only:', e.message);
    return { ok: true, persisted: false };
  }
}

// Recent (last 4 h) reports for a set of station ids, grouped by station id.
export async function loadReportsFor(stationIds) {
  if (!stationIds || !stationIds.length) return {};
  try {
    const sinceIso = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .in('station_id', stationIds)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const byStation = {};
    for (const row of data || []) {
      const list = byStation[row.station_id] || (byStation[row.station_id] = []);
      list.push(mapReportRow(row));
    }
    return byStation;
  } catch (e) {
    console.warn('loadReportsFor unavailable:', e.message);
    return {};
  }
}
