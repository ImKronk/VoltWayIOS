// Loads the OCM + ORS + TomTom API keys from Supabase app_config.
// Mirrors fetchAppConfigFromSupabase() in the web app. TomTom (real-time
// traffic) defaults to the provided key, overridable via app_config.
import { supabase } from '../config/supabase';

const TOMTOM_DEFAULT_KEY = 'Py7VtrX9fYaI36fUAvXnc789R8aL6D5V';

export async function fetchApiKeys() {
  const keys = { ocm: '', ors: '', tomtom: TOMTOM_DEFAULT_KEY };
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['ocm_api_key', 'ors_api_key', 'tomtom_api_key']);
    if (error) throw error;
    for (const row of data || []) {
      if (row.key === 'ocm_api_key') keys.ocm = row.value;
      if (row.key === 'ors_api_key') keys.ors = row.value;
      if (row.key === 'tomtom_api_key' && row.value) keys.tomtom = row.value;
    }
    console.log('Keys loaded from Supabase:', {
      ocm: !!keys.ocm,
      ors: !!keys.ors,
      tomtom: !!keys.tomtom,
    });
  } catch (e) {
    console.warn('Could not load API keys from Supabase:', e.message);
  }
  return keys;
}
