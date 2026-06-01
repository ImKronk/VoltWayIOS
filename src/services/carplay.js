// CarPlay integration (premium-gated). Projects VoltWay onto the car screen:
//  - a list of nearby charging stations (tap to route on the phone)
//  - a map template (host for turn-by-turn once the maps entitlement is granted)
//
// IMPORTANT: this only works in a NATIVE build (EAS) that ships react-native-
// carplay AND carries an Apple CarPlay entitlement. In Expo Go the native
// module is absent, so requiring the library throws — we catch that and every
// function below becomes a safe no-op, leaving the rest of the app untouched.
import { Platform } from 'react-native';

let mod = null;
let attempted = false;

// Lazily + safely load react-native-carplay. Returns null when unavailable
// (Expo Go, Android, or a build without the native module / entitlement).
function getModule() {
  if (attempted) return mod;
  attempted = true;
  if (Platform.OS !== 'ios') {
    mod = null;
    return null;
  }
  try {
    // Requiring instantiates a NativeEventEmitter over RNCarPlay; if the native
    // module isn't in this binary it throws here — hence the guard.
    // eslint-disable-next-line global-require
    mod = require('react-native-carplay');
    if (!mod || !mod.CarPlay) mod = null;
  } catch (e) {
    mod = null;
  }
  return mod;
}

export function carPlaySupported() {
  return !!getModule();
}

let onConnect = null;
let onDisconnect = null;
let data = { getStations: () => [], getLocation: () => null, onNavigate: () => {} };

function buildStationsList(m) {
  const stations = (data.getStations() || []).slice(0, 12);
  return new m.ListTemplate({
    title: 'Postos perto',
    sections: [
      {
        header: 'Carregamento',
        items: stations.map((s) => ({
          text: s.name || 'Posto',
          detailText: [s.dist, s.speed ? `${s.speed} kW` : null].filter(Boolean).join('  ·  '),
        })),
      },
    ],
    onItemSelect: async ({ index }) => {
      const s = stations[index];
      if (s) data.onNavigate(s);
    },
  });
}

function buildMap(m) {
  // Hosts the map on the car screen. Full turn-by-turn needs a CarPlay
  // navigation session (CPNavigationSession) + the carplay-maps entitlement;
  // wire that once Apple grants it.
  return new m.MapTemplate({
    guidanceBackgroundColor: '#395B64',
    component: undefined,
  });
}

function buildRoot(m) {
  const list = buildStationsList(m);
  const map = buildMap(m);
  // "Ambos": stations list + map, switchable via the CarPlay tab bar.
  return new m.TabBarTemplate({ templates: [list, map] });
}

// Start projecting to CarPlay. `accessors` = { getStations, getLocation,
// onNavigate(station) }. Safe no-op when CarPlay isn't available.
export function initCarPlay(accessors) {
  const m = getModule();
  if (!m) return false;
  data = { ...data, ...accessors };

  const setRoot = () => {
    try {
      m.CarPlay.setRootTemplate(buildRoot(m), true);
    } catch (e) {
      // CarPlay not actually connected / approved — ignore.
    }
  };

  try {
    onConnect = () => setRoot();
    onDisconnect = () => {};
    m.CarPlay.registerOnConnect(onConnect);
    m.CarPlay.registerOnDisconnect(onDisconnect);
    if (m.CarPlay.connected) setRoot();
    return true;
  } catch (e) {
    return false;
  }
}

// Refresh the car screen (e.g. after stations/location update).
export function refreshCarPlay() {
  const m = getModule();
  if (!m) return;
  try {
    if (m.CarPlay.connected) m.CarPlay.setRootTemplate(buildRoot(m), false);
  } catch (e) {
    // ignore
  }
}

export function teardownCarPlay() {
  const m = getModule();
  if (!m) return;
  try {
    if (onConnect) m.CarPlay.unregisterOnConnect(onConnect);
    if (onDisconnect) m.CarPlay.unregisterOnDisconnect(onDisconnect);
  } catch (e) {
    // ignore
  }
  onConnect = null;
  onDisconnect = null;
}
