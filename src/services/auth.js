// Auth + profile actions — wraps supabase.auth.
// The AppContext auth listener picks up the resulting user changes.
import { supabase } from '../config/supabase';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user || null, error: error?.message || null };
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { user: data?.user || null, error: error?.message || null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message || null };
}

// Stores vehicle fields in the user's auth metadata.
export async function updateVehicle(vehicleData) {
  const { data, error } = await supabase.auth.updateUser({ data: vehicleData });
  return { user: data?.user || null, error: error?.message || null };
}

export async function updateName(name) {
  const { data, error } = await supabase.auth.updateUser({ data: { name } });
  return { user: data?.user || null, error: error?.message || null };
}
