// Map screen — Apple Maps + station markers + draggable bottom sheet.
// Ports #screen-map (map, bottom sheet, search, chips, station list).
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Keyboard } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state/AppContext';
import { colors, radius, shadow, statusColor } from '../theme/theme';
import { fmtPrice, fmtSpeedShort } from '../utils/format';
import { stationSupportsConnector } from '../utils/connectors';
import { haversineKm } from '../utils/geo';
import { freeInMinutes } from '../services/stationStatus';
import { planRoute } from '../services/routing';
import { autocompleteAddress } from '../services/geocode';
import { loadRecentSearches, addRecentSearch } from '../services/recentSearches';
import RouteInfoCard from '../components/RouteInfoCard';
import SideMenu from '../components/SideMenu';
import VehicleEditSheet from '../components/VehicleEditSheet';
import ReportSheet from '../components/ReportSheet';

const CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'available', label: 'Disponível' },
  { key: 'fast', label: 'Rápido' },
  { key: 'cheap', label: 'Barato' },
];

// Stations within this radius (km) of the user can be reported.
const REPORT_RADIUS_KM = 0.8;
const REPORT_RADIUS_LABEL =
  REPORT_RADIUS_KM < 1 ? `${REPORT_RADIUS_KM * 1000} m` : `${REPORT_RADIUS_KM} km`;

export default function MapScreen({ navigation }) {
  const app = useApp();
  const mapRef = useRef(null);
  const sheetRef = useRef(null);
  const searchDebounce = useRef(null);
  const snapPoints = useMemo(() => ['18%', '56%', '92%'], []);
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [chip, setChip] = useState('all');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vehicleEditOpen, setVehicleEditOpen] = useState(false);
  // Report flow: reportMode = picking a station; reportStation = the picked one.
  const [reportMode, setReportMode] = useState(false);
  const [reportStation, setReportStation] = useState(null);

  const {
    location, stations, route, connector, batteryPrefs, keys, loading,
    setRoute, clearRoute, refreshStationsNear,
  } = app;

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

  // Load the persisted search history once.
  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
  }, []);

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
      const res = await planRoute(destination, {
        stations,
        origin: location,
        batteryPrefs,
        userConnector: connector,
        orsKey: keys.ors,
      });
      if (!res.ok) {
        Alert.alert('Rota', res.error);
        return;
      }
      setRoute(res.route);
      addRecentSearch(recentSearches, destination).then(setRecentSearches);
      refreshStationsNear(destination.lat, destination.lng);
      sheetRef.current?.snapToIndex(0);
    } catch (e) {
      Alert.alert('Erro', e.message || 'Falha ao calcular a rota.');
    } finally {
      setBusy(false);
    }
  }

  // Live address autocomplete (OpenRouteService geocoding), debounced.
  function onSearchChange(text) {
    setSearch(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      const results = await autocompleteAddress(text, keys.ors, location);
      setSuggestions(results);
    }, 300);
  }

  // The user picked an address suggestion -> route straight to it.
  function pickSuggestion(sug) {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    setSearch(sug.name);
    setSuggestions([]);
    Keyboard.dismiss();
    routeTo({ lat: sug.lat, lng: sug.lng, name: sug.name });
  }

  // Keyboard "search" key: use the top suggestion, else the device geocoder.
  async function doSearch() {
    const q = search.trim();
    if (q.length < 3) {
      Alert.alert('Pesquisa', 'Escreve um destino com pelo menos 3 letras.');
      return;
    }
    if (suggestions.length) {
      pickSuggestion(suggestions[0]);
      return;
    }
    setBusy(true);
    try {
      const results = await Location.geocodeAsync(q);
      if (!results || !results.length) {
        Alert.alert('Destino', 'Não foi possível encontrar esse local.');
        return;
      }
      await routeTo({ lat: results[0].latitude, lng: results[0].longitude, name: q });
    } catch (e) {
      Alert.alert('Erro', e.message || 'Falha na pesquisa.');
    } finally {
      setBusy(false);
    }
  }

  const ListHeader = (
    <View>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <BottomSheetTextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Para onde vais?"
          placeholderTextColor={colors.c3}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={doSearch}
          onFocus={() => {
            setSearchFocused(true);
            sheetRef.current?.snapToIndex(2);
          }}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
        />
        {busy ? <ActivityIndicator size="small" color={colors.c2} /> : null}
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.suggestBox}>
          {suggestions.map((sug, i) => (
            <TouchableOpacity
              key={`${sug.lat},${sug.lng},${i}`}
              style={[styles.suggestRow, i > 0 && styles.suggestRowBorder]}
              onPress={() => pickSuggestion(sug)}
              activeOpacity={0.6}
            >
              <Text style={styles.suggestIcon}>📍</Text>
              <Text style={styles.suggestTxt} numberOfLines={2}>{sug.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {searchFocused && suggestions.length === 0 ? (
        recentSearches.length > 0 ? (
          <View style={styles.suggestBox}>
            <Text style={styles.historyLabel}>RECENTES</Text>
            {recentSearches.map((r, i) => (
              <TouchableOpacity
                key={`${r.lat},${r.lng},${i}`}
                style={[styles.suggestRow, styles.suggestRowBorder]}
                onPress={() => pickSuggestion(r)}
                activeOpacity={0.6}
              >
                <Text style={styles.suggestIcon}>🕘</Text>
                <Text style={styles.suggestTxt} numberOfLines={1}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.searchHint}>
            As tuas pesquisas recentes vão aparecer aqui.
          </Text>
        )
      ) : null}

      {!searchFocused ? (
        <>
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
        </>
      ) : null}
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
        {displayed.map((s) => (
          <Marker
            key={String(s.id)}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            onPress={() => onStationPress(s)}
          >
            <View
              style={[
                reportMode ? styles.pinReport : styles.pin,
                { backgroundColor: statusColor(s.status) },
              ]}
            >
              <Text style={styles.pinTxt}>⚡</Text>
            </View>
          </Marker>
        ))}

        {route?.stopStation && (
          <Marker
            coordinate={{ latitude: route.stopStation.lat, longitude: route.stopStation.lng }}
            onPress={() => navigation.navigate('StationDetail', { station: route.stopStation })}
          >
            <View
              style={[
                styles.pinBig,
                { backgroundColor: route.analysis?.emergency ? colors.red : colors.yellow },
              ]}
            >
              <Text style={styles.pinTxt}>⚡</Text>
            </View>
          </Marker>
        )}

        {route?.destination && (
          <Marker
            coordinate={{ latitude: route.destination.lat, longitude: route.destination.lng }}
            title={route.destination.name}
          >
            <View style={[styles.pinBig, { backgroundColor: colors.red }]}>
              <Text style={styles.pinTxt}>📍</Text>
            </View>
          </Marker>
        )}

        {route?.coords?.length ? (
          <Polyline coordinates={route.coords} strokeColor={colors.c2} strokeWidth={6} />
        ) : null}
      </MapView>

      <TouchableOpacity
        style={[styles.hamburger, { top: insets.top + 8 }]}
        onPress={() => setMenuOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.hbLine} />
        <View style={styles.hbLine} />
        <View style={styles.hbLine} />
      </TouchableOpacity>

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

      {route ? (
        <RouteInfoCard
          route={route}
          onClear={clearRoute}
          onStart={() => navigation.navigate('Navigation')}
        />
      ) : null}

      {loading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={colors.c2} />
          <Text style={styles.loadingTxt}>A carregar postos…</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.locateFab} onPress={recenter} activeOpacity={0.8}>
        <Text style={styles.locateTxt}>◎</Text>
      </TouchableOpacity>

      {!reportMode ? (
        <TouchableOpacity
          style={styles.reportFab}
          onPress={enterReportMode}
          activeOpacity={0.85}
        >
          <Text style={styles.reportTxt}>⚠️</Text>
        </TouchableOpacity>
      ) : null}

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetFlatList
          data={searchFocused ? [] : displayed}
          keyExtractor={(s) => String(s.id)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={ListHeader}
          ListFooterComponent={searchFocused || reportMode ? null : ListFooter}
          contentContainerStyle={{ paddingBottom: 36 }}
          ListEmptyComponent={
            searchFocused ? null : (
              <Text style={styles.empty}>
                {reportMode
                  ? `Nenhum posto num raio de ${REPORT_RADIUS_LABEL} de ti.`
                  : 'Nenhum posto compatível com o teu conector nesta área.'}
              </Text>
            )
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
  searchInput: { flex: 1, fontSize: 17, color: colors.c1, padding: 0, fontWeight: '500' },

  suggestBox: {
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 14,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.c3,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestRowBorder: { borderTopWidth: 1, borderTopColor: colors.c4 },
  suggestIcon: { fontSize: 16 },
  suggestTxt: { flex: 1, fontSize: 14, color: colors.c1, fontWeight: '500' },
  historyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text3,
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  searchHint: {
    fontSize: 13,
    color: colors.text3,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
  },

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
