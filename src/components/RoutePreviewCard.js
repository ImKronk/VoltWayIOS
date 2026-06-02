// Apple-Maps-style route summary card shown at the bottom when a route is
// active: big ETA, toll badge, distance, "Via <road>", optional EV charging
// stop, and the action buttons. The "Iniciar" button carries a progress bar
// that auto-starts the trip when it fills (cancellable by tapping the card).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme/theme';

function tollLabel(route) {
  if (route.tollPrice != null) {
    return `Taxa ${route.tollPrice.toFixed(2).replace('.', ',')} €`;
  }
  if (route.hasTolls) {
    const km = route.tollDistanceM / 1000;
    return km >= 1 ? `Portagens · ${Math.round(km)} km` : 'Com portagens';
  }
  return 'Sem portagens';
}

// Live traffic note (from the TomTom-refined ETA). Falls back to a neutral
// label when traffic data isn't available.
function trafficLabel(route) {
  if (route.trafficDelaySec == null) return 'Trânsito habitual';
  const min = Math.round(route.trafficDelaySec / 60);
  if (route.trafficLevel === 'heavy') return `🚦 Trânsito intenso · +${min} min`;
  if (route.trafficLevel === 'moderate') return `🚦 Algum trânsito · +${min} min`;
  return '🟢 Trânsito fluido';
}

export default function RoutePreviewCard({
  route,
  onStart,
  onClear,
  onPlan,
  autoStartMs = 5000,
  pauseSignal = 0,
  resetSignal = 0,
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const intervalRef = useRef(null);
  const startedTrip = useRef(false);
  const startTsRef = useRef(0);
  const [auto, setAuto] = useState(true);
  const [remaining, setRemaining] = useState(Math.round(autoStartMs / 1000));

  function clearTimers() {
    animRef.current?.stop?.();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // (Re)start the auto-start countdown whenever the active route changes
  // (new search, selected alternative, or Evitar recompute).
  useEffect(() => {
    startedTrip.current = false;
    setAuto(true);
    setRemaining(Math.round(autoStartMs / 1000));
    progress.setValue(0);
    startTsRef.current = Date.now();

    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: autoStartMs,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished && !startedTrip.current) {
        startedTrip.current = true;
        onStart();
      }
    });

    intervalRef.current = setInterval(() => {
      const left = Math.max(0, autoStartMs - (Date.now() - startTsRef.current));
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) clearTimers();
    }, 250);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, autoStartMs]);

  // Cancel the auto-start (user wants to look around first).
  function cancelAuto() {
    if (!auto) return;
    setAuto(false);
    clearTimers();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  // Parent bumps `pauseSignal` on external interaction (e.g. opening the
  // Evitar menu) to cancel the auto-start. Skip the initial mount value.
  const firstPause = useRef(true);
  useEffect(() => {
    if (firstPause.current) {
      firstPause.current = false;
      return;
    }
    cancelAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseSignal]);

  // Parent bumps `resetSignal` when the map regains focus (returning from
  // navigation). Fully disarm: no countdown, and "Iniciar" works again as a
  // plain button (prevents a re-arm loop since the screen stays mounted).
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    clearTimers();
    startedTrip.current = false;
    setAuto(false);
    progress.setValue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // Start the trip immediately.
  function startNow() {
    if (startedTrip.current) return;
    startedTrip.current = true;
    clearTimers();
    onStart();
  }

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const needsStop = route.analysis?.needsStop && route.stopStation;

  return (
    <View style={[s.card, { paddingBottom: insets.bottom + 12 }]}>
      <View style={s.handle} />

      <Pressable onPress={cancelAuto}>
        <View style={s.summaryRow}>
          <Text style={s.duration}>{route.durationText}</Text>
          <View style={[s.tollBadge, route.hasTolls && s.tollBadgeOn]}>
            <Text style={[s.tollTxt, route.hasTolls && s.tollTxtOn]}>{tollLabel(route)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={s.distance}>{route.distanceText}</Text>
        </View>

        <Text style={s.via} numberOfLines={1}>
          {route.roadName ? `Via ${route.roadName}` : 'Rota mais rápida'}
        </Text>

        {needsStop ? (
          <Text style={[s.note, route.analysis.emergency && s.noteEmergency]} numberOfLines={1}>
            {route.analysis.emergency ? '🚨' : '⚡'} Paragem: {route.stopStation.name}
          </Text>
        ) : null}
        {route.belowMin ? (
          <Text style={[s.note, s.noteEmergency]} numberOfLines={1}>
            ⚠️ Rota mais eficiente — bateria desce a {route.stopArrivalBatt}% (abaixo do mínimo)
          </Text>
        ) : null}
        <Text
          style={[s.note, route.trafficLevel === 'heavy' && s.noteEmergency]}
          numberOfLines={1}
        >
          {trafficLabel(route)}
        </Text>

        {auto ? (
          <Text style={s.autoHint}>Início automático em {remaining}s · toca para cancelar</Text>
        ) : null}
      </Pressable>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.planBtn} onPress={onPlan} activeOpacity={0.85}>
          <Text style={s.planTxt}>Programar rota</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.startBtn} onPress={startNow} activeOpacity={0.9}>
          {auto ? <Animated.View style={[s.progress, { width }]} /> : null}
          <Text style={s.startTxt}>{auto ? `Iniciar · ${remaining}s` : 'Iniciar'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onClear} style={s.cancelRow} hitSlop={8}>
        <Text style={s.cancelTxt}>Cancelar rota</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    ...shadow.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.c3,
    marginBottom: 12,
  },

  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  duration: { fontSize: 30, fontWeight: '800', color: colors.navy },
  tollBadge: {
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tollBadgeOn: { backgroundColor: '#eef2e9' },
  tollTxt: { fontSize: 12, fontWeight: '700', color: colors.text2 },
  tollTxtOn: { color: colors.text2 },
  distance: { fontSize: 16, fontWeight: '700', color: colors.text2 },

  via: { fontSize: 15, color: colors.navy, fontWeight: '600', marginTop: 6 },
  note: { fontSize: 13, color: colors.text3, marginTop: 3 },
  noteEmergency: { color: colors.red, fontWeight: '700' },
  autoHint: { fontSize: 12, color: colors.c2, marginTop: 8, fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  planBtn: {
    flex: 1,
    backgroundColor: colors.c4,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTxt: { color: colors.c2, fontSize: 15, fontWeight: '700' },
  startBtn: {
    flex: 1.3,
    backgroundColor: colors.c2,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  startTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  cancelRow: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  cancelTxt: { fontSize: 14, color: colors.text3, fontWeight: '600' },
});
