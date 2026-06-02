// Map screen — Apple Maps + station markers + draggable bottom sheet.
// Ports #screen-map (map, bottom sheet, search, chips, station list).
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { useApp } from '../state/AppContext';
import { colors, radius, shadow, statusColor } from '../theme/theme';
import { fmtPrice, fmtSpeedShort } from '../utils/format';
import { stationSupportsConnector } from '../utils/connectors';
import { haversineKm } from '../utils/geo';
import { freeInMinutes } from '../services/stationStatus';
import RoutePreviewCard from '../components/RoutePreviewCard';
import RouteTopBar from '../components/RouteTopBar';
import SideMenu from '../components/SideMenu';
import VehicleEditSheet from '../components/VehicleEditSheet';
import ReportSheet from '../components/ReportSheet';
import SearchOverlay from '../components/SearchOverlay';
import StationIcon from '../components/StationIcon';
import DestinationPin from '../components/DestinationPin';

const CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'available', label: 'Disponível' },
  { key: 'fast', label: 'Rápido' },
  { key: 'cheap', label: 'Barato' },
];

// Anchor so the bolt icon's bottom tip (at ~97.7% of its height) lands on the
// station's exact coordinate — same dynamic as the destination pin.
const BOLT_ANCHOR = { x: 0.5, y: 0.977 };

// Stations within this radius (km) of the user can be reported.
const REPORT_RADIUS_KM = 0.8;
const REPORT_RADIUS_LABEL =
  REPORT_RADIUS_KM < 1 ? `${REPORT_RADIUS_KM * 1000} m` : `${REPORT_RADIUS_KM} km`;

export default function MapScreen({ navigation }) {
  const app = useApp();
  const mapRef = useRef(null);
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ['18%', '56%', '100%'], []);
  const insets = useSafeAreaInsets();
  const [searchOpen, setSearchOpen] = useState(false);
  const [chip, setChip] = useState('all');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vehicleEditOpen, setVehicleEditOpen] = useState(false);
  // Report flow: reportMode = picking a station; reportStation = the picked one.
  const [reportMode, setReportMode] = useState(false);
  const [reportStation, setReportStation] = useState(null);
  // Bumped to cancel the route card's auto-start when the user interacts.
  const [autoPauseSignal, setAutoPauseSignal] = useState(0);
  // Bumped each time the map regains focus (e.g. returning from navigation)
  // so the preview card resets to a plain, non-auto-starting state.
  const isFocused = useIsFocused();
  const wasFocused = useRef(true);
  const [focusEpoch, setFocusEpoch] = useState(0);
  useEffect(() => {
    if (isFocused && !wasFocused.current) setFocusEpoch((n) => n + 1);
    wasFocused.current = isFocused;
  }, [isFocused]);

  const {
    location, stations, route, connector, keys, loading,
    clearRoute,
    routeOptions, selectRouteOption, avoid, setAvoid, planAndSetRoute,
  } = app;

  // Remount the map when a route is cancelled. react-native-maps on iOS keeps
  // Polyline overlays drawn even after they unmount, so the cleared route can
  // linger on screen; re-keying the MapView forces a clean reset to the user's
  // area. Only fires on the route→no-route transition (not when setting one).
  const prevRouteRef = useRef(route);
  const [mapResetKey, setMapResetKey] = useState(0);
  useEffect(() => {
    if (prevRouteRef.current && !route) setMapResetKey((k) => k + 1);
    prevRouteRef.current = route;
  }, [route]);

  // Bumped on every route/options change. Used in the Polyline keys so they
  // remount (and actually redraw) when the geometry changes — react-native-maps
  // on iOS does not redraw a Polyline when only its coordinates prop updates.
  const [routeVersion, setRouteVersion] = useState(0);
  useEffect(() => {
    setRouteVersion((v) => v + 1);
  }, [route, routeOptions]);

  // Index of the currently selected route option (for highlighting).
  const selIndex = Math.max(0, routeOptions.indexOf(route));

  // When a route is active, only connector-compatible stations are shown.
  const visible = useMemo(() => {
    let list = route ? stations.filter((s) => stationSupportsConnector(s, connector)) : stations;
    if (chip === 'available') list = list.filter((s) => s.status === 'available');
    else if (chip === 'fast') list = list.filter((s) => (s.speed || 0) >= 100);
    else if (chip === 'cheap') list = [...list].sort((a, b) => (a.price ?? 99) - (b.price ?? 99));
    return list;
  }, [stations, route, connector, chip]);

  // Stations within the report radius of the user.
  const inRange = useMemo(
    () =>
      stations.filter(
        (s) => haversineKm(location.lat, location.lng, s.lat, s.lng) <= REPORT_RADIUS_KM,
      ),
    [stations, location],
  );

  // What the map + list display: nearby stations while reporting, else normal.
  const displayed = reportMode ? inRange : visible;

  // Fit the map to the route whenever it changes.
  useEffect(() => {
    if (route?.coords?.length && mapRef.current) {
      mapRef.current.fitToCoordinates(route.coords, {
        edgePadding: { top: 160, right: 60, bottom: 360, left: 60 },
        animated: true,
      });
    }
  }, [route]);

  // Close the search overlay once a route is set (e.g. after picking a place).
  useEffect(() => {
    if (route) setSearchOpen(false);
  }, [route]);

  const recenter = useCallback(() => {
    mapRef.current?.animateToRegion(
      { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      400,
    );
  }, [location]);

  // Enter the report flow: zoom to the user, collapse the sheet so the
  // nearby station markers are clearly visible for tapping.
  const enterReportMode = useCallback(() => {
    setReportMode(true);
    setReportStation(null);
    sheetRef.current?.snapToIndex(0);
    mapRef.current?.animateToRegion(
      { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.018, longitudeDelta: 0.018 },
      500,
    );
  }, [location]);

  const exitReport = useCallback(() => {
    setReportMode(false);
    setReportStation(null);
  }, []);

  // Tapping a station: pick it for a report, or open its detail screen.
  const onStationPress = useCallback(
    (s) => {
      if (reportMode) setReportStation(s);
      else navigation.navigate('StationDetail', { station: s });
    },
    [reportMode, navigation],
  );

  // Calculates and shows the route to a destination, applying the EV rules
  // (battery range, connector filter, optimal/emergency charging stop).
  async function routeTo(destination) {
    setBusy(true);
    try {
      // planAndSetRoute already loads chargers near both the origin and the
      // destination, so no separate refresh is needed here.
      const res = await planAndSetRoute(destination);
      if (!res.ok) {
        Alert.alert('Rota', res.error);
        return;
      }
    } catch (e) {
      Alert.alert('Erro', e.message || 'Falha ao calcular a rota.');
    } finally {
      setBusy(false);
    }
  }

  // Toggle one Evitar feature and recompute the route with the new set.
  function toggleAvoid(key) {
    const next = avoid.includes(key) ? avoid.filter((k) => k !== key) : [...avoid, key];
    setAvoid(next);
  }

  const ListHeader = (
    <View>
      {/* Tapping opens the same full-screen search used in navigation. */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => setSearchOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Para onde vais?</Text>
      </TouchableOpacity>

      <View style={styles.chipsRow}>
        {CHIPS.map((c) => {
          const active = chip === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setChip(c.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.predBanner} onPress={() => navigation.navigate('Prediction')}>
        <View style={styles.predIconBox}>
          <Text style={styles.predIconTxt}>🔮</Text>
        </View>
        <Text style={styles.predTxt} numberOfLines={1}>Posto livre em ~20 min</Text>
        <Text style={styles.predPct}>75%</Text>
        <Text style={styles.predArrow}>›</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>
        {reportMode
          ? `ESCOLHE UM POSTO  ·  ${inRange.length}`
          : `${route ? 'POSTOS COMPATÍVEIS' : 'POSTOS PERTO'}  ·  ${visible.length}`}
      </Text>
    </View>
  );

  const ListFooter = (
    <TouchableOpacity style={styles.routeCta} onPress={() => navigation.navigate('Route')}>
      <Text style={styles.routeCtaText}>Planear rota  →</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <MapView
        key={mapResetKey}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {/* Stations as lightning bolts. When a route is active they shrink so
            the charging stop (rendered larger below) stands out. The charging
            stop itself is skipped here to avoid drawing it twice. */}
        {displayed
          .filter((s) => !(route?.stopStation && s.id === route.stopStation.id))
          .map((s) => (
            <Marker
              key={String(s.id)}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              onPress={() => onStationPress(s)}
              anchor={BOLT_ANCHOR}
            >
              <StationIcon size={route ? 18 : 30} />
            </Marker>
          ))}

        {/* Charging stop — kept large so it's the clear point to charge. */}
        {route?.stopStation && (
          <Marker
            key={`stop-${routeVersion}`}
            coordinate={{ latitude: route.stopStation.lat, longitude: route.stopStation.lng }}
            onPress={() => navigation.navigate('StationDetail', { station: route.stopStation })}
            anchor={BOLT_ANCHOR}
            zIndex={4}
          >
            <StationIcon size={42} />
          </Marker>
        )}

        {route?.destination && (
          <Marker
            key={`dest-${routeVersion}`}
            coordinate={{ latitude: route.destination.lat, longitude: route.destination.lng }}
            title={route.destination.name}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={4}
          >
            <DestinationPin size={42} />
          </Marker>
        )}

        {/* Route alternatives — non-selected drawn underneath. Each has a wide
            invisible hit-area polyline on top so the thin line is easy to tap. */}
        {routeOptions.map((opt, i) =>
          i === selIndex ? null : (
            <React.Fragment key={`altwrap-${routeVersion}-${i}`}>
              <Polyline
                coordinates={opt.coords}
                strokeColor="rgba(255,255,255,0.01)"
                strokeWidth={28}
                tappable
                onPress={() => selectRouteOption(i)}
                zIndex={2}
              />
              <Polyline
                coordinates={opt.coords}
                strokeColor="rgba(120,134,150,0.6)"
                strokeWidth={5}
                tappable
                onPress={() => selectRouteOption(i)}
                zIndex={1}
              />
            </React.Fragment>
          ),
        )}
        {route?.coords?.length ? (
          <Polyline
            key={`sel-${routeVersion}-${selIndex}`}
            coordinates={route.coords}
            strokeColor={colors.c2}
            strokeWidth={7}
            zIndex={3}
          />
        ) : null}

        {/* Time bubbles, one per alternative (only when there's a choice) */}
        {routeOptions.length > 1 &&
          routeOptions.map((opt, i) => {
            const mid = opt.coords[Math.floor(opt.coords.length / 2)];
            if (!mid) return null;
            const selected = i === selIndex;
            return (
              <Marker
                key={`bubble-${routeVersion}-${i}`}
                coordinate={mid}
                onPress={() => selectRouteOption(i)}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={selected ? 5 : 2}
              >
                <View style={[styles.bubble, selected ? styles.bubbleOn : styles.bubbleOff]}>
                  <Text style={[styles.bubbleTxt, selected ? styles.bubbleTxtOn : styles.bubbleTxtOff]}>
                    {opt.belowMin ? '⚠️ ' : ''}{opt.durationText}
                  </Text>
                </View>
              </Marker>
            );
          })}
      </MapView>

      {!route ? (
        <TouchableOpacity
          style={[styles.hamburger, { top: insets.top + 8 }]}
          onPress={() => setMenuOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.hbLine} />
          <View style={styles.hbLine} />
          <View style={styles.hbLine} />
        </TouchableOpacity>
      ) : (
        <RouteTopBar
          destName={route.destination?.name}
          onBack={clearRoute}
          avoid={avoid}
          onToggleAvoid={toggleAvoid}
          onInteract={() => setAutoPauseSignal((n) => n + 1)}
        />
      )}

      {reportMode && !reportStation ? (
        <View style={[styles.reportBanner, { top: insets.top + 8 }]}>
          <Text style={styles.reportBannerTxt} numberOfLines={1}>
            {inRange.length
              ? '📢 Toca num posto para reportar'
              : `📢 Sem postos a menos de ${REPORT_RADIUS_LABEL}`}
          </Text>
          <TouchableOpacity onPress={exitReport} hitSlop={10}>
            <Text style={styles.reportBannerX}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={colors.c2} />
          <Text style={styles.loadingTxt}>A carregar postos…</Text>
        </View>
      ) : null}

      {!route ? (
        <TouchableOpacity style={styles.locateFab} onPress={recenter} activeOpacity={0.8}>
          <Text style={styles.locateTxt}>◎</Text>
        </TouchableOpacity>
      ) : null}

      {!reportMode && !route ? (
        <TouchableOpacity
          style={styles.reportFab}
          onPress={enterReportMode}
          activeOpacity={0.85}
        >
          <Text style={styles.reportTxt}>⚠️</Text>
        </TouchableOpacity>
      ) : null}

      {/* No active route → search + filters + station list. */}
      {!route ? (
        <BottomSheet
          ref={sheetRef}
          index={1}
          snapPoints={snapPoints}
          topInset={insets.top}
          backgroundStyle={styles.sheetBg}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <BottomSheetFlatList
            data={displayed}
            keyExtractor={(s) => String(s.id)}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={ListHeader}
            ListFooterComponent={reportMode ? null : ListFooter}
            contentContainerStyle={{ paddingBottom: 36 }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {reportMode
                  ? `Nenhum posto num raio de ${REPORT_RADIUS_LABEL} de ti.`
                  : 'Nenhum posto compatível com o teu conector nesta área.'}
              </Text>
            }
            renderItem={({ item: s }) => {
              const freeIn = s.status === 'occupied' ? freeInMinutes(s) : null;
              return (
                <TouchableOpacity
                  style={styles.stCard}
                  onPress={() => onStationPress(s)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.stIcon, { backgroundColor: statusColor(s.status) }]}>
                    <Text style={styles.stIconTxt}>⚡</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.stMeta}>
                      {s.dist || '—'}   ·   {fmtSpeedShort(s)}
                    </Text>
                    {freeIn != null ? (
                      <Text style={styles.stFreeIn}>
                        ⏳ {freeIn > 0 ? `Livre em ~${freeIn} min` : 'Livre em breve'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.stPrice}>{fmtPrice(s)}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </BottomSheet>
      ) : null}

      {/* Active route → Apple-Maps-style preview card with auto-start. */}
      {route ? (
        <RoutePreviewCard
          route={route}
          onStart={() => navigation.navigate('Navigation')}
          onClear={clearRoute}
          onPlan={() => navigation.navigate('Route')}
          autoStartMs={10000}
          pauseSignal={autoPauseSignal}
          resetSignal={focusEpoch}
        />
      ) : null}

      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        onEditVehicle={() => setVehicleEditOpen(true)}
      />
      <VehicleEditSheet visible={vehicleEditOpen} onClose={() => setVehicleEditOpen(false)} />
      <ReportSheet
        visible={!!reportStation}
        station={reportStation}
        onClose={exitReport}
      />

      {/* Full-screen search — identical to the navigation screen's search. */}
      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={routeTo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // ─── Map markers (bigger) ───
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinReport: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBig: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTxt: { fontSize: 18 },

  // ─── Route alternative time bubbles ───
  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    ...shadow.card,
  },
  bubbleOn: { backgroundColor: colors.c2 },
  bubbleOff: { backgroundColor: '#fff' },
  bubbleTxt: { fontSize: 13, fontWeight: '800' },
  bubbleTxtOn: { color: '#fff' },
  bubbleTxtOff: { color: colors.navy },

  loadingPill: {
    position: 'absolute',
    bottom: '20%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    ...shadow.lg,
  },
  loadingTxt: { fontSize: 13, color: colors.text2, fontWeight: '600' },

  // ─── Report-mode banner ───
  reportBanner: {
    position: 'absolute',
    left: 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.c2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    ...shadow.lg,
  },
  reportBannerTxt: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  reportBannerX: { color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: '700' },

  // ─── Floating buttons (bigger) ───
  locateFab: {
    position: 'absolute',
    left: 16,
    bottom: '20%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  locateTxt: { fontSize: 24, color: colors.c1 },

  reportFab: {
    position: 'absolute',
    right: 16,
    bottom: '20%',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  reportTxt: { fontSize: 27 },

  hamburger: {
    position: 'absolute',
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    ...shadow.lg,
  },
  hbLine: { width: 20, height: 2.6, borderRadius: 2, backgroundColor: colors.c1 },

  // ─── Bottom sheet ───
  sheetBg: { backgroundColor: colors.card, borderRadius: 28 },
  sheetHandle: { backgroundColor: colors.c3, width: 44, height: 5 },

  // ─── Search (bigger) ───
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: colors.c4,
    borderWidth: 1.5,
    borderColor: colors.c3,
    borderRadius: 16,
  },
  searchIcon: { fontSize: 19 },
  searchPlaceholder: { flex: 1, fontSize: 17, color: colors.c3, fontWeight: '500' },

  // ─── Filter chips (bigger) ───
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: colors.c4,
    borderWidth: 1.5,
    borderColor: colors.c3,
  },
  chipActive: { backgroundColor: colors.c2, borderColor: colors.c2 },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.c2 },
  chipTextActive: { color: '#fff' },

  // ─── Prediction banner ───
  predBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.c4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(165,201,202,0.5)',
  },
  predIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predIconTxt: { fontSize: 21 },
  predTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.c1 },
  predPct: { fontSize: 17, fontWeight: '800', color: colors.c2 },
  predArrow: { fontSize: 22, color: colors.c3, fontWeight: '700' },

  // ─── Section title ───
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.c1,
    paddingHorizontal: 18,
    marginBottom: 10,
    letterSpacing: 0.4,
  },

  // ─── Station cards ───
  stCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.c4,
    ...shadow.card,
  },
  stIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stIconTxt: { fontSize: 24 },
  stName: { fontSize: 16, fontWeight: '700', color: colors.navy },
  stMeta: { fontSize: 13, color: colors.text2, marginTop: 4, fontWeight: '500' },
  stFreeIn: { fontSize: 12, color: colors.red, marginTop: 4, fontWeight: '700' },
  stPrice: { fontSize: 18, fontWeight: '800', color: colors.navy },

  empty: { padding: 24, fontSize: 14, color: colors.text3, textAlign: 'center', lineHeight: 20 },

  // ─── Footer CTA ───
  routeCta: {
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: colors.c2,
    borderRadius: radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
  },
  routeCtaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
