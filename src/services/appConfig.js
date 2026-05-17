// Loads the OCM + ORS API keys from Supabase app_config.
// Mirrors fetchAppConfigFromSupabase() in the web app.
import { supabase } from '../config/supabase';

export async function fetchApiKeys() {
  const keys = { ocm: '', ors: '' };
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['ocm_api_key', 'ors_api_key']);
    if (error) throw error;
    for (const row of data || []) {
      if (row.key === 'ocm_api_key') keys.ocm = row.value;
      if (row.key === 'ors_api_key') keys.ors = row.value;
    }
    console.log('Keys loaded from Supabase:', { ocm: !!keys.ocm, ors: !!keys.ors });
  } catch (e) {
    console.warn('Could not load API keys from Supabase:', e.message);
  }
  return keys;
}
