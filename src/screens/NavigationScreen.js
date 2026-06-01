// Turn-by-turn navigation — Waze-style layout: black maneuver banner with a
// "then" preview, heading-up map, dark speed dial, current-street pill, report
// button, and a draggable bottom bar (drag up to reveal "Terminar viagem").
// The search button reroutes from the live position (always via the most
// efficient charging stop). The sound button picks a voice mode.
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, shadow } from '../theme/theme';
import { haversineKm } from '../utils/geo';
import { computeProgress, fmtDistance, fmtDuration, fmtEta } from '../services/navigation';
import ManeuverArrow from '../components/ManeuverArrow';
import ReportSheet from '../components/ReportSheet';
import { autocompleteAddress } from '../services/geocode';
import { loadRecentSearches, addRecentSearch } from '../services/recentSearches';

const CYAN = '#34C8F0';

const VOICE_OPTIONS = [
  { mode: 'full', label: 'Indicações', icon: '🔊' },
  { mode: 'alerts', label: 'Só alertas', icon: '🔔' },
  { mode: 'none', label: 'Sem som', icon: '🔇' },
];
const voiceIconFor = (m) => (VOICE_OPTIONS.find((v) => v.mode === m) || VOICE_OPTIONS[0]).icon;

export default function NavigationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { route, keys, location, stations, planAndSetRoute } = useApp();

  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const headingSubRef = useRef(null);
  const headingRef = useRef(0); // smoothed compass heading (deg) driving rotation
  const lastPosRef = useRef(null); // latest { latitude, longitude }
  const camTickRef = useRef(0); // throttle for compass-driven camera animations
  const prevRef = useRef(null); // { lat, lng, t } — for derived speed
  const speedRef = useRef(null); // last smoothed km/h
  const spokenRef = useRef(null);
  const arrivedRef = useRef(false);
  const routeRef = useRef(route); // latest route, so live reroutes take effect
  const voiceModeRef = useRef('full');
  const endSheetRef = useRef(null);

  const [progress, setProgress] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [voiceMode, setVoiceMode] = useState('full'); // 'full' | 'alerts' | 'none'
  const [voiceMenu, setVoiceMenu] = useState(false);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSel, setReportSel] = useState(null);
  const [recalc, setRecalc] = useState(false);

  // Search overlay state.
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [recents, setRecents] = useState([]);
  const searchDebounce = useRef(null);

  // Keep refs current for the long-lived GPS callback.
  routeRef.current = route;
  voiceModeRef.current = voiceMode;

  const endSnap = useMemo(() => ['15%', '34%'], []);

  // Reset spoken/arrival markers whenever the route changes (e.g. a reroute).
  useEffect(() => {
    spokenRef.current = null;
    arrivedRef.current = false;
  }, [route]);

  useEffect(() => {
    loadRecentSearches().then(setRecents);
  }, []);

  useEffect(() => {
    if (!route?.coords?.length) {
      navigation.goBack();
      return undefined;
    }
    let active = true;

    function updateCamera(duration) {
      const center = lastPosRef.current;
      if (!center || !mapRef.current) return;
      const v = speedRef.current || 0; // km/h
      const altitude = Math.min(900, 300 + v * 5);
      const pitch = v < 1 ? 25 : Math.min(55, 30 + v * 2.5);
      mapRef.current.animateCamera(
        { center, heading: headingRef.current, pitch, altitude },
        { duration },
      );
    }

    function handlePosition(pos) {
      if (!active || !pos?.coords) return;
      const userPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      lastPosRef.current = userPos;

      // Speed — prefer GPS Doppler, fall back to movement between fixes while
      // ignoring sub-accuracy jitter, then lightly smooth.
      const now = { lat: userPos.latitude, lng: userPos.longitude, t: pos.timestamp || Date.now() };
      const gps = pos.coords.speed;
      let kmh = 0;
      if (gps != null && gps >= 0) {
        kmh = gps * 3.6;
      } else if (prevRef.current && now.t > prevRef.current.t) {
        const dm = haversineKm(prevRef.current.lat, prevRef.current.lng, now.lat, now.lng) * 1000;
        const dt = (now.t - prevRef.current.t) / 1000;
        const noise = Math.max(6, pos.coords.accuracy || 0);
        if (dt > 0 && dm > noise) kmh = (dm / dt) * 3.6;
      }
      prevRef.current = now;
      const smoothed = speedRef.current == null ? kmh : speedRef.current * 0.4 + kmh * 0.6;
      speedRef.current = smoothed;
      setSpeed(smoothed < 3 ? 0 : Math.round(smoothed));

      const prog = computeProgress(routeRef.current, userPos);
      setProgress(prog);
      updateCamera(900);

      // Voice guidance, gated by the chosen mode.
      const vm = voiceModeRef.current;
      if (
        prog.nextStep &&
        prog.distanceToNext < 280 &&
        spokenRef.current !== prog.nextStep.wayPoint
      ) {
        spokenRef.current = prog.nextStep.wayPoint;
        if (vm === 'full') {
          Speech.speak(`Em ${fmtDistance(prog.distanceToNext)}. ${prog.nextStep.instruction}`, {
            language: 'pt-PT',
          });
        }
      }
      if (prog.arrived && !arrivedRef.current) {
        arrivedRef.current = true;
        if (vm !== 'none') Speech.speak('Chegaste ao destino.', { language: 'pt-PT' });
      }
    }

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) {
        navigation.goBack();
        return;
      }
      try {
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        handlePosition(first);
      } catch (e) {
        // ignore — the watcher will deliver shortly
      }
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 1000 },
        handlePosition,
      );
      if (active) watchRef.current = sub;
      else sub.remove();

      // Compass: rotate the map toward where the phone points (heading-up).
      const headSub = await Location.watchHeadingAsync((h) => {
        if (!active) return;
        const deg = h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (deg == null || deg < 0) return;
        const prev = headingRef.current;
        const a = 0.2;
        const smooth =
          (Math.atan2(
            Math.sin((prev * Math.PI) / 180) * (1 - a) + Math.sin((deg * Math.PI) / 180) * a,
            Math.cos((prev * Math.PI) / 180) * (1 - a) + Math.cos((deg * Math.PI) / 180) * a,
          ) *
            180) /
          Math.PI;
        headingRef.current = (smooth + 360) % 360;
        const t = Date.now();
        let diff = Math.abs(headingRef.current - prev);
        if (diff > 180) diff = 360 - diff;
        if (diff >= 1.5 && t - camTickRef.current > 90) {
          camTickRef.current = t;
          updateCamera(150);
        }
      });
      if (active) headingSubRef.current = headSub;
      else headSub.remove();
    })();

    return () => {
      active = false;
      watchRef.current?.remove?.();
      headingSubRef.current?.remove?.();
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!route?.coords?.length) return null;

  const stop = () => {
    Speech.stop();
    watchRef.current?.remove?.();
    headingSubRef.current?.remove?.();
    navigation.goBack();
  };

  function pickVoice(mode) {
    setVoiceMode(mode);
    setVoiceMenu(false);
    if (mode === 'none') Speech.stop();
  }

  function baseLatLng() {
    const p = lastPosRef.current;
    return p ? { lat: p.latitude, lng: p.longitude } : location;
  }

  function openReport() {
    const base = baseLatLng();
    let best = null;
    let bd = Infinity;
    for (const s of stations) {
      const d = haversineKm(base.lat, base.lng, s.lat, s.lng);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    setReportSel(best);
    setReportOpen(true);
  }

  // ─── Search overlay (full-screen) ───
  function openSearch() {
    setQ('');
    setSugg([]);
    setSearchOpen(true);
  }
  function onSearchChange(text) {
    setQ(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (text.trim().length < 3) {
      setSugg([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      const results = await autocompleteAddress(text, keys.ors, baseLatLng());
      setSugg(results);
    }, 300);
  }
  async function rerouteTo(dest) {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    Keyboard.dismiss();
    setSearchOpen(false);
    setRecalc(true);
    // Reroute from the live position; planAndSetRoute keeps the most efficient
    // charging stop in the plan.
    const res = await planAndSetRoute(
      { lat: dest.lat, lng: dest.lng, name: dest.name },
      undefined,
      baseLatLng(),
    );
    setRecalc(false);
    if (!res.ok) {
      Alert.alert('Rota', res.error || 'Não foi possível recalcular a rota.');
      return;
    }
    addRecentSearch(recents, { lat: dest.lat, lng: dest.lng, name: dest.name }).then(setRecents);
  }
  async function submitSearch() {
    const text = q.trim();
    if (text.length < 3) return;
    if (sugg.length) {
      rerouteTo(sugg[0]);
      return;
    }
    try {
      const r = await Location.geocodeAsync(text);
      if (r && r.length) rerouteTo({ lat: r[0].latitude, lng: r[0].longitude, name: text });
      else Alert.alert('Destino', 'Não foi possível encontrar esse local.');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Falha na pesquisa.');
    }
  }

  const next = progress?.nextStep;
  const following = progress?.followingStep;
  const arrived = progress?.arrived;
  const currentName = progress?.currentName;
  const showFloaters = sheetIdx <= 0; // hide when the end-trip sheet is expanded

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: route.coords[0].latitude,
          longitude: route.coords[0].longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        }}
      >
        <Polyline coordinates={route.coords} strokeColor={colors.c2} strokeWidth={8} />
        {route.stopStation && (
          <Marker coordinate={{ latitude: route.stopStation.lat, longitude: route.stopStation.lng }}>
            <View style={[s.pin, { backgroundColor: colors.yellow }]}>
              <Text style={s.pinTxt}>⚡</Text>
            </View>
          </Marker>
        )}
        {route.destination && (
          <Marker coordinate={{ latitude: route.destination.lat, longitude: route.destination.lng }}>
            <View style={[s.pin, { backgroundColor: colors.red }]}>
              <Text style={s.pinTxt}>🏁</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top maneuver banner (black) + "e a seguir" preview */}
      <View style={s.banner}>
        <View style={[s.bannerMain, { paddingTop: insets.top + 12 }]}>
          {!progress ? (
            <Text style={s.bannerBig}>A iniciar navegação…</Text>
          ) : arrived ? (
            <Text style={s.bannerBig}>🏁  Chegaste ao destino</Text>
          ) : (
            <>
              <View style={s.maneuver}>
                <ManeuverArrow type={next ? next.type : 6} size={52} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bannerDist}>
                  {fmtDistance(next ? progress.distanceToNext : progress.remainingDistance)}
                </Text>
                <Text style={s.bannerStreet} numberOfLines={2}>
                  {next
                    ? next.name || next.instruction
                    : `Continua até ${route.destination?.name || 'ao destino'}`}
                </Text>
              </View>
            </>
          )}
        </View>
        {!arrived && following ? (
          <View style={s.bannerNext}>
            <Text style={s.nextLabel}>e a seguir</Text>
            <ManeuverArrow type={following.type} size={24} color="#fff" />
            {following.name ? (
              <Text style={s.nextName} numberOfLines={1}>
                {following.name}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Floating: speed dial · current street · report */}
      {showFloaters ? (
        <>
          <View style={[s.speedDial, { bottom: insets.bottom + 118 }]}>
            <Text style={s.speedVal}>{speed}</Text>
            <Text style={s.speedUnit}>km/h</Text>
          </View>

          {currentName ? (
            <View style={[s.streetPill, { bottom: insets.bottom + 130 }]} pointerEvents="none">
              <Text style={s.streetTxt} numberOfLines={1}>
                {currentName}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.reportBtn, { bottom: insets.bottom + 118 }]}
            onPress={openReport}
            activeOpacity={0.85}
          >
            <Text style={s.reportTxt}>⚠️</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {recalc ? (
        <View style={s.recalcPill}>
          <ActivityIndicator size="small" color={colors.c2} />
          <Text style={s.recalcTxt}>A recalcular rota…</Text>
        </View>
      ) : null}

      {/* Bottom bar — drag up to reveal "Terminar viagem" */}
      <BottomSheet
        ref={endSheetRef}
        index={0}
        snapPoints={endSnap}
        onChange={setSheetIdx}
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetHandle}
      >
        <BottomSheetView style={[s.sheetContent, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.etaRow}>
            <TouchableOpacity style={s.circleBtn} onPress={openSearch} activeOpacity={0.8}>
              <Text style={s.circleIcon}>🔍</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.etaTime}>{progress ? fmtEta(progress.remainingDuration) : '--:--'}</Text>
              <Text style={s.etaSub}>
                {progress
                  ? `${fmtDuration(progress.remainingDuration)}  ·  ${fmtDistance(progress.remainingDistance)}`
                  : 'A calcular…'}
              </Text>
            </View>
            <TouchableOpacity style={s.circleBtn} onPress={() => setVoiceMenu(true)} activeOpacity={0.8}>
              <Text style={s.circleIcon}>{voiceIconFor(voiceMode)}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.endBtn} onPress={stop} activeOpacity={0.9}>
            <Text style={s.endTxt}>Terminar viagem</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      {/* Voice-mode menu */}
      {voiceMenu ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={s.menuBackdrop} onPress={() => setVoiceMenu(false)} />
          <View style={[s.voiceMenu, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={s.voiceTitle}>Som da navegação</Text>
            {VOICE_OPTIONS.map((o) => {
              const on = o.mode === voiceMode;
              return (
                <TouchableOpacity
                  key={o.mode}
                  style={[s.voiceRow, on && s.voiceRowOn]}
                  onPress={() => pickVoice(o.mode)}
                  activeOpacity={0.7}
                >
                  <Text style={s.voiceIcon}>{o.icon}</Text>
                  <Text style={[s.voiceLabel, on && s.voiceLabelOn]}>{o.label}</Text>
                  {on ? <Text style={s.voiceCheck}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Full-screen search (reroute) */}
      {searchOpen ? (
        <View style={[s.searchOverlay, { paddingTop: insets.top + 8 }]}>
          <View style={s.searchHeader}>
            <TouchableOpacity onPress={() => setSearchOpen(false)} hitSlop={12} style={s.searchBack}>
              <Text style={s.searchBackTxt}>‹</Text>
            </TouchableOpacity>
            <View style={s.searchInputWrap}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                value={q}
                onChangeText={onSearchChange}
                placeholder="Para onde vais?"
                placeholderTextColor={colors.text3}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={submitSearch}
              />
              {q.length > 0 ? (
                <TouchableOpacity onPress={() => { setQ(''); setSugg([]); }} hitSlop={10}>
                  <Text style={s.searchClear}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {sugg.length > 0
              ? sugg.map((sg, i) => (
                  <TouchableOpacity
                    key={`${sg.lat},${sg.lng},${i}`}
                    style={s.resultRow}
                    onPress={() => rerouteTo(sg)}
                    activeOpacity={0.6}
                  >
                    <Text style={s.resultIcon}>📍</Text>
                    <Text style={s.resultTxt} numberOfLines={2}>{sg.name}</Text>
                  </TouchableOpacity>
                ))
              : (
                <>
                  <Text style={s.resultsLabel}>RECENTES</Text>
                  {recents.length ? (
                    recents.map((r, i) => (
                      <TouchableOpacity
                        key={`${r.lat},${r.lng},${i}`}
                        style={s.resultRow}
                        onPress={() => rerouteTo(r)}
                        activeOpacity={0.6}
                      >
                        <Text style={s.resultIcon}>🕘</Text>
                        <Text style={s.resultTxt} numberOfLines={1}>{r.name}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={s.resultsEmpty}>As tuas pesquisas recentes aparecem aqui.</Text>
                  )}
                </>
              )}
          </ScrollView>
        </View>
      ) : null}

      <ReportSheet visible={reportOpen} station={reportSel} onClose={() => setReportOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTxt: { fontSize: 16 },

  // ─── Banner ───
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0A0A',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  bannerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  maneuver: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  bannerDist: { fontSize: 32, fontWeight: '800', color: '#fff' },
  bannerStreet: { fontSize: 22, color: CYAN, fontWeight: '700', marginTop: 2, lineHeight: 26 },
  bannerBig: { fontSize: 20, fontWeight: '800', color: '#fff' },

  bannerNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  nextLabel: { fontSize: 16, color: CYAN, fontWeight: '700' },
  nextName: { flex: 1, fontSize: 14, color: '#C7C7CC', fontWeight: '600' },

  // ─── Floating speed dial ───
  speedDial: {
    position: 'absolute',
    left: 16,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#1B1B1D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    ...shadow.lg,
  },
  speedVal: { fontSize: 23, fontWeight: '800', color: '#fff' },
  speedUnit: { fontSize: 9, color: '#9A9A9F', fontWeight: '700', marginTop: -2 },

  // ─── Current-street pill ───
  streetPill: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '60%',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    ...shadow.lg,
  },
  streetTxt: { fontSize: 15, fontWeight: '800', color: colors.navy, textAlign: 'center' },

  // ─── Report button ───
  reportBtn: {
    position: 'absolute',
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  reportTxt: { fontSize: 26 },

  recalcPill: {
    position: 'absolute',
    top: '46%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    ...shadow.lg,
  },
  recalcTxt: { fontSize: 13, color: colors.text2, fontWeight: '700' },

  // ─── Bottom sheet ───
  sheetBg: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { backgroundColor: colors.c3, width: 44, height: 5 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIcon: { fontSize: 20 },
  etaTime: { fontSize: 26, fontWeight: '800', color: colors.navy },
  etaSub: { fontSize: 14, color: colors.text2, marginTop: 2, fontWeight: '600' },
  endBtn: {
    marginTop: 16,
    backgroundColor: colors.red,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  endTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ─── Voice menu ───
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  voiceMenu: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    ...shadow.lg,
  },
  voiceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text3,
    letterSpacing: 0.4,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 14,
  },
  voiceRowOn: { backgroundColor: colors.bg },
  voiceIcon: { fontSize: 22, width: 26, textAlign: 'center' },
  voiceLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.navy },
  voiceLabelOn: { color: colors.c2, fontWeight: '800' },
  voiceCheck: { fontSize: 16, fontWeight: '800', color: colors.c2 },

  // ─── Search overlay ───
  searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', paddingHorizontal: 16 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchBack: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchBackTxt: { fontSize: 30, color: colors.navy, fontWeight: '700', marginTop: -4 },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchIcon: { fontSize: 17 },
  searchInput: { flex: 1, fontSize: 16, color: colors.navy, padding: 0, fontWeight: '500' },
  searchClear: { fontSize: 15, color: colors.text3, fontWeight: '800' },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text3,
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 6,
  },
  resultsEmpty: { fontSize: 14, color: colors.text3, paddingHorizontal: 6, paddingTop: 6 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  resultIcon: { fontSize: 18 },
  resultTxt: { flex: 1, fontSize: 15, color: colors.navy, fontWeight: '500' },
});
