// Supabase client for React Native.
// Uses AsyncStorage so the auth session survives app restarts.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Same project as the web app (see web supabase-config.js).
const SUPABASE_URL = 'https://evtzovpvzngxqnwuhlcf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EsgGRwBqDO_chN8RpfJ0Pg_guCpnIlB';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
