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
  fmtDistance,
  fmtDuration,
  fmtEta,
} from '../services/navigation';
import ManeuverArrow from '../components/ManeuverArrow';
import CompassRose from '../components/CompassRose';

export default function NavigationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { route } = useApp();
  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const headingSubRef = useRef(null);
  const headingRef = useRef(0); // smoothed compass heading (deg) driving rotation
  const lastPosRef = useRef(null); // latest { latitude, longitude } for the camera
  const camTickRef = useRef(0); // throttle for compass-driven camera animations
  const prevRef = useRef(null); // { lat, lng, t } — for derived speed
  const speedRef = useRef(null); // last smoothed km/h
  const spokenRef = useRef(null);
  const arrivedRef = useRef(false);

  const [progress, setProgress] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0); // for the compass indicator

  useEffect(() => {
    if (!route?.coords?.length) {
      navigation.goBack();
      return undefined;
    }
    let active = true;

    // Drive the camera from a single source: centred on the car, rotated to
    // the phone's compass heading, with speed-adaptive zoom + tilt. Called
    // both on GPS fixes (position/zoom) and on compass ticks (rotation), so
    // the map turns as you point the phone, not only when the car moves.
    function updateCamera(duration) {
      const center = lastPosRef.current;
      if (!center || !mapRef.current) return;
      const v = speedRef.current || 0; // km/h
      // Zoom in tight at low speed (more turn detail), pull out at speed.
      const altitude = Math.min(900, 300 + v * 5); // 0→300m, 60→600m, 120+→900m
      // Flatten the tilt when stopped for an easier-to-read near top-down view.
      const pitch = v < 1 ? 25 : Math.min(55, 30 + v * 2.5); // stopped→25°, ≥10→55°
      mapRef.current.animateCamera(
        { center, heading: headingRef.current, pitch, altitude },
        { duration },
      );
    }

    // Handle one GPS sample: speed, progress, camera, voice.
    function handlePosition(pos) {
      if (!active || !pos?.coords) return;
      const userPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      lastPosRef.current = userPos;

      // Speed — prefer the GPS Doppler value (accurate, reads 0 when stopped);
      // only fall back to movement-between-samples when GPS speed is missing,
      // and then ignore movement smaller than the fix's accuracy so GPS jitter
      // doesn't show phantom km/h while parked.
      const now = { lat: userPos.latitude, lng: userPos.longitude, t: pos.timestamp || Date.now() };
      const gps = pos.coords.speed; // m/s, or null/-1 when unknown
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
      // Light exponential smoothing to steady the readout between fixes.
      const smoothed = speedRef.current == null ? kmh : speedRef.current * 0.4 + kmh * 0.6;
      speedRef.current = smoothed;
      setSpeed(smoothed < 3 ? 0 : Math.round(smoothed));

      const prog = computeProgress(route, userPos);
      setProgress(prog);

      // Re-centre + re-zoom on each fix. Uses `altitude` (not `zoom`): on
      // iOS/Apple Maps, repeatedly animating with `zoom` converts against the
      // live mid-animation region and drifts into an infinite zoom-out.
      updateCamera(900);

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

      // Compass: rotate the map toward where the phone points. The device
      // heading (magnetometer) is smoothed circularly to kill jitter, then
      // fed to the camera (throttled) and the on-screen compass indicator.
      const headSub = await Location.watchHeadingAsync((h) => {
        if (!active) return;
        const deg = h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (deg == null || deg < 0) return;

        // Circular smoothing (handles the 359°→0° wrap correctly).
        const prev = headingRef.current;
        const a = 0.2;
        const ps = Math.sin((prev * Math.PI) / 180);
        const pc = Math.cos((prev * Math.PI) / 180);
        const ns = Math.sin((deg * Math.PI) / 180);
        const nc = Math.cos((deg * Math.PI) / 180);
        const smooth =
          (Math.atan2(ps * (1 - a) + ns * a, pc * (1 - a) + nc * a) * 180) / Math.PI;
        headingRef.current = (smooth + 360) % 360;

        // Rotate the map, throttled, only on a meaningful change.
        const t = Date.now();
        let diff = Math.abs(headingRef.current - prev);
        if (diff > 180) diff = 360 - diff;
        if (diff >= 1.5 && t - camTickRef.current > 90) {
          camTickRef.current = t;
          updateCamera(150);
        }
        setHeading(Math.round(headingRef.current));
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
            <View style={s.maneuver}>
              <ManeuverArrow type={next ? next.type : 6} size={48} color="#fff" />
            </View>
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

      {/* North compass — rotates so the arrow always points to true north */}
      <View style={[s.compass, { top: insets.top + 112 }]}>
        <CompassRose heading={heading} size={28} color={colors.navy} />
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
  maneuver: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  bannerDist: { fontSize: 30, fontWeight: '800', color: '#fff' },
  bannerStreet: { fontSize: 15, color: '#9FC4CC', fontWeight: '600', marginTop: 3, lineHeight: 20 },
  bannerArrived: { fontSize: 19, fontWeight: '800', color: '#fff', textAlign: 'center' },

  compass: {
    position: 'absolute',
    left: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },

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
