// Global app state — replaces the module-level globals (UL/UG, stations,
// currentUser, activeConnectorFilter, ...) used in the web app.js.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { fetchApiKeys } from '../services/appConfig';
import { loadOCMStations, loadSupabaseStations } from '../services/stations';
import { planRoute } from '../services/routing';
import { loadReportsFor, mapReportRow } from '../services/reports';
import { fallbackStations } from '../data/pricing';
import { reconcileStatus } from '../services/stationStatus';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const PARIS = { lat: 48.8566, lng: 2.3522 }; // default until geolocation resolves

// Adds crowd-status tracking fields to freshly loaded stations.
function normalizeStations(list) {
  return list.map((s) => ({
    ...s,
    baseStatus: s.baseStatus ?? s.status, // original OCM / Supabase status
    reports: s.reports ?? [], // [{ status, at, points }]
    occupiedUntil: s.occupiedUntil ?? null,
  }));
}

// Appends community reports to a station and re-derives its status.
function applyReports(station, newReports) {
  const reports = [...(station.reports || []), ...newReports].slice(-20);
  const withReports = { ...station, reports };
  const resolved = reconcileStatus(withReports);
  return { ...withReports, status: resolved.status, occupiedUntil: resolved.occupiedUntil };
}

export function AppProvider({ children }) {
  const [location, setLocation] = useState(PARIS);
  const [stations, setStations] = useState(() => normalizeStations(fallbackStations));
  const [keys, setKeys] = useState({ ocm: '', ors: '' });
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(null); // currently selected route option
  const [routeOptions, setRouteOptions] = useState([]); // all alternatives
  const [avoid, setAvoidState] = useState([]); // Evitar: ['tollways','highways','ferries']
  const routeReqRef = useRef(null); // last route request, for recompute on avoid change
  const [selectedStation, setSelectedStation] = useState(null);
  const [batteryPrefs, setBatteryPrefs] = useState({ currentBatt: 65, minBatt: 15, maxDist: 150 });
  const [loading, setLoading] = useState(true);

  // Premium subscription flag (persisted locally). Gates premium-only features
  // such as automatic car-battery sync.
  const [premium, setPremiumState] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('voltway:premium').then((v) => {
      if (v === '1') setPremiumState(true);
    });
  }, []);
  const setPremium = useCallback((val) => {
    setPremiumState(!!val);
    AsyncStorage.setItem('voltway:premium', val ? '1' : '0').catch(() => {});
  }, []);

  // Connector chosen in the user's profile (null when logged out -> show all).
  const connector = user?.user_metadata?.connector || null;

  // Current user id in a ref so the realtime callback can skip our own
  // reports without re-subscribing whenever the user changes.
  const userIdRef = useRef(null);
  userIdRef.current = user?.id || null;

  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1. Geolocation (falls back to Paris on denial/failure).
      let loc = PARIS;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch (e) {
        console.warn('Geolocation failed:', e.message);
      }
      if (mounted) setLocation(loc);

      // 2. API keys from Supabase app_config.
      const apiKeys = await fetchApiKeys();
      if (mounted) setKeys(apiKeys);

      // 3. Real stations from OCM, falling back to Supabase, then bundled data.
      let st = await loadOCMStations(loc.lat, loc.lng, apiKeys.ocm);
      if (!st) st = await loadSupabaseStations();
      if (mounted && st) {
        setStations(normalizeStations(st));
        // 3b. Seed live community reports for those stations from Supabase.
        const reportsByStation = await loadReportsFor(st.map((x) => x.id));
        if (mounted && Object.keys(reportsByStation).length) {
          setStations((prev) =>
            prev.map((s) => {
              const rs = reportsByStation[s.id];
              return rs && rs.length ? applyReports(s, rs) : s;
            }),
          );
        }
      }

      // 4. Restore any persisted auth session.
      const { data } = await supabase.auth.getSession();
      if (mounted) setUser(data?.session?.user || null);

      if (mounted) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Reload OCM stations around a new coordinate (e.g. after a destination search).
  const refreshStationsNear = useCallback(
    async (lat, lng) => {
      const st = await loadOCMStations(lat, lng, keys.ocm);
      if (st) setStations(normalizeStations(st));
    },
    [keys.ocm],
  );

  // Plan a route to a destination and store the selected option + alternatives.
  // Remembers the request so the Evitar toggle can recompute it later.
  const planAndSetRoute = useCallback(
    async (destination, prefsOverride, originOverride) => {
      const prefs = prefsOverride || batteryPrefs;
      const origin = originOverride || location;
      routeReqRef.current = { destination, origin, batteryPrefs: prefs };
      const res = await planRoute(destination, {
        stations,
        origin,
        batteryPrefs: prefs,
        userConnector: connector,
        orsKey: keys.ors,
        avoid,
      });
      if (res.ok) {
        setRoute(res.route);
        setRouteOptions(res.routeOptions);
      }
      return res;
    },
    [stations, location, batteryPrefs, connector, keys.ors, avoid],
  );

  // Pick one of the alternative route options as the active route.
  const selectRouteOption = useCallback((index) => {
    setRouteOptions((opts) => {
      if (opts[index]) setRoute(opts[index]);
      return opts;
    });
  }, []);

  // Update the Evitar selection and recompute the current route with it.
  const setAvoid = useCallback(
    async (next) => {
      setAvoidState(next);
      const req = routeReqRef.current;
      if (!req) return { ok: true };
      const res = await planRoute(req.destination, {
        stations,
        origin: req.origin,
        batteryPrefs: req.batteryPrefs,
        userConnector: connector,
        orsKey: keys.ors,
        avoid: next,
      });
      if (res.ok) {
        setRoute(res.route);
        setRouteOptions(res.routeOptions);
      }
      return res;
    },
    [stations, connector, keys.ors],
  );

  // Clear the active route and everything derived from it.
  const clearRoute = useCallback(() => {
    setRoute(null);
    setRouteOptions([]);
    setAvoidState([]);
    routeReqRef.current = null;
  }, []);

  // Records a community report and re-derives the station's status. An
  // "occupied" report schedules an auto-return to "available" after the
  // estimated charging time; a fresh "available" report wins immediately.
  const reportStation = useCallback(
    (stationId, status) => {
      const report = { status, at: Date.now(), points: user?.user_metadata?.points || 0 };
      setStations((prev) =>
        prev.map((st) => (st.id === stationId ? applyReports(st, [report]) : st)),
      );
    },
    [user],
  );

  // Periodically re-reconcile so "occupied" estimates expire on their own —
  // the station returns to "available" once the charge window passes.
  useEffect(() => {
    const id = setInterval(() => {
      setStations((prev) => {
        if (!prev.some((st) => st.reports && st.reports.length)) return prev;
        let changed = false;
        const next = prev.map((st) => {
          if (!st.reports || !st.reports.length) return st;
          const resolved = reconcileStatus(st);
          if (resolved.status !== st.status || resolved.occupiedUntil !== st.occupiedUntil) {
            changed = true;
            return { ...st, status: resolved.status, occupiedUntil: resolved.occupiedUntil };
          }
          return st;
        });
        // Refresh if a status changed or any "free in ~X min" countdown is live.
        return changed || next.some((st) => st.occupiedUntil) ? next : prev;
      });
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Live multi-user feed: apply other users' reports the moment they arrive.
  // Auto-connects on launch; needs the online setup SQL run once in Supabase.
  useEffect(() => {
    const channel = supabase
      .channel('voltway-reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          const row = payload.new;
          if (!row || !row.station_id) return;
          // Skip our own reports — already applied optimistically.
          if (row.user_id && row.user_id === userIdRef.current) return;
          const report = mapReportRow(row);
          setStations((prev) =>
            prev.map((st) => (st.id === row.station_id ? applyReports(st, [report]) : st)),
          );
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('Realtime: community reports feed connected');
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const value = {
    location,
    stations,
    keys,
    user,
    connector,
    route,
    setRoute,
    routeOptions,
    selectRouteOption,
    avoid,
    setAvoid,
    planAndSetRoute,
    clearRoute,
    selectedStation,
    setSelectedStation,
    batteryPrefs,
    setBatteryPrefs,
    loading,
    premium,
    setPremium,
    refreshStationsNear,
    reportStation,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
