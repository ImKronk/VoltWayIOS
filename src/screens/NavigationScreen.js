// Turn-by-turn navigation — live GPS following, maneuver banner, ETA, voice.
// Started from the route card's "Iniciar viagem" button.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, shadow } from '../theme/theme';
import { haversineKm } from '../utils/geo';
import {
  computeProgress,
  maneuverIcon,
  fmtDistance,
  fmtDuration,
  fmtEta,
} from '../services/navigation';

export default function NavigationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { route } = useApp();
  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const headingRef = useRef(0);
  const prevRef = useRef(null); // { lat, lng, t } — for derived speed
  const spokenRef = useRef(null);
  const arrivedRef = useRef(false);

  const [progress, setProgress] = useState(null);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    if (!route?.coords?.length) {
      navigation.goBack();
      return undefined;
    }
    let active = true;

    // Handle one GPS sample: speed, progress, camera, voice.
    function handlePosition(pos) {
      if (!active || !pos?.coords) return;
      const userPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      if (pos.coords.heading != null && pos.coords.heading >= 0) {
        headingRef.current = pos.coords.heading;
      }

      // Speed — the GPS value when available, otherwise derived from movement
      // between samples so it is always counted.
      const now = { lat: userPos.latitude, lng: userPos.longitude, t: pos.timestamp || Date.now() };
      let derivedKmh = 0;
      if (prevRef.current && now.t > prevRef.current.t) {
        const dm = haversineKm(prevRef.current.lat, prevRef.current.lng, now.lat, now.lng) * 1000;
        const dt = (now.t - prevRef.current.t) / 1000;
        if (dt > 0) derivedKmh = (dm / dt) * 3.6;
      }
      prevRef.current = now;
      const gps = pos.coords.speed;
      const kmh = gps != null && gps >= 0 ? gps * 3.6 : derivedKmh;
      setSpeed(kmh < 3 ? 0 : Math.round(kmh));

      const prog = computeProgress(route, userPos);
      setProgress(prog);

      // Camera follows the car, rotated to the heading (course-up).
      mapRef.current?.animateCamera(
        { center: userPos, heading: headingRef.current, pitch: 55, zoom: 17 },
        { duration: 1000 },
      );

      // Voice: announce each maneuver once, as it gets close.
      if (
        prog.nextStep &&
        prog.distanceToNext < 280 &&
        spokenRef.current !== prog.nextStep.wayPoint
      ) {
        spokenRef.current = prog.nextStep.wayPoint;
        Speech.speak(`Em ${fmtDistance(prog.distanceToNext)}. ${prog.nextStep.instruction}`, {
          language: 'pt-PT',
        });
      }
      if (prog.arrived && !arrivedRef.current) {
        arrivedRef.current = true;
        Speech.speak('Chegaste ao destino.', { language: 'pt-PT' });
      }
    }

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) {
        navigation.goBack();
        return;
      }
      // Immediate first fix so the banner + speed populate right away.
      try {
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        handlePosition(first);
      } catch (e) {
        // ignore — the watcher will deliver shortly
      }
      // Continuous updates.
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 1000 },
        handlePosition,
      );
      if (active) watchRef.current = sub;
      else sub.remove();
    })();

    return () => {
      active = false;
      watchRef.current?.remove?.();
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!route?.coords?.length) return null;

  const stop = () => {
    Speech.stop();
    watchRef.current?.remove?.();
    navigation.goBack();
  };

  const next = progress?.nextStep;
  const arrived = progress?.arrived;

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
          <Marker
            coordinate={{ latitude: route.stopStation.lat, longitude: route.stopStation.lng }}
          >
            <View style={[s.pin, { backgroundColor: colors.yellow }]}>
              <Text style={s.pinTxt}>⚡</Text>
            </View>
          </Marker>
        )}
        {route.destination && (
          <Marker
            coordinate={{ latitude: route.destination.lat, longitude: route.destination.lng }}
          >
            <View style={[s.pin, { backgroundColor: colors.red }]}>
              <Text style={s.pinTxt}>🏁</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top maneuver banner */}
      <View style={[s.banner, { paddingTop: insets.top + 14 }]}>
        {!progress ? (
          <Text style={s.bannerArrived}>A iniciar navegação…</Text>
        ) : arrived ? (
          <Text style={s.bannerArrived}>🏁  Chegaste ao destino</Text>
        ) : (
          <View style={s.bannerRow}>
            <Text style={s.maneuver}>{next ? maneuverIcon(next.type) : '↑'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerDist}>
                {fmtDistance(next ? progress.distanceToNext : progress.remainingDistance)}
              </Text>
              <Text style={s.bannerStreet} numberOfLines={2}>
                {next
                  ? next.instruction
                  : `Continua até ${route.destination?.name || 'ao destino'}`}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Speedometer */}
      <View style={[s.speedPill, { bottom: insets.bottom + 116 }]}>
        <Text style={s.speedVal}>{speed}</Text>
        <Text style={s.speedUnit}>km/h</Text>
      </View>

      {/* Bottom ETA bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={s.spacer} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.eta}>{progress ? fmtEta(progress.remainingDuration) : '--:--'}</Text>
          <Text style={s.etaSub}>
            {progress
              ? `${fmtDuration(progress.remainingDuration)}  ·  ${fmtDistance(progress.remainingDistance)}`
              : 'A calcular…'}
          </Text>
        </View>
        <TouchableOpacity style={s.stopBtn} onPress={stop} activeOpacity={0.85}>
          <Text style={s.stopTxt}>✕</Text>
        </TouchableOpacity>
      </View>
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

  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1B2838',
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  maneuver: { fontSize: 50, color: '#fff', fontWeight: '300', width: 58, textAlign: 'center' },
  bannerDist: { fontSize: 30, fontWeight: '800', color: '#fff' },
  bannerStreet: { fontSize: 15, color: '#9FC4CC', fontWeight: '600', marginTop: 3, lineHeight: 20 },
  bannerArrived: { fontSize: 19, fontWeight: '800', color: '#fff', textAlign: 'center' },

  speedPill: {
    position: 'absolute',
    left: 16,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#1B2838',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  speedVal: { fontSize: 23, fontWeight: '800', color: '#fff' },
  speedUnit: { fontSize: 9, color: '#9FC4CC', fontWeight: '700', marginTop: -2 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...shadow.lg,
  },
  spacer: { width: 52 },
  eta: { fontSize: 26, fontWeight: '800', color: colors.navy },
  etaSub: { fontSize: 14, color: colors.text2, marginTop: 2, fontWeight: '600' },
  stopBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopTxt: { fontSize: 22, color: '#fff', fontWeight: '700' },
});
