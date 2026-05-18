// Persisted recent destination searches (survives app restarts).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'voltway:recentSearches';
const MAX = 8;

export async function loadRecentSearches() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// Prepends a destination (deduped by name), caps the list, persists it.
export async function addRecentSearch(current, destination) {
  const item = { name: destination.name, lat: destination.lat, lng: destination.lng };
  const next = [item, ...current.filter((r) => r.name !== item.name)].slice(0, MAX);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    // persistence is best-effort
  }
  return next;
}
