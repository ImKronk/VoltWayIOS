// Floating route summary card shown at the top of the map when a route
// is active. Ports the redesigned (chip-based) stop cards from app.js.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme/theme';

function Chip({ bg, fg, text }) {
  return <Text style={[s.chip, { backgroundColor: bg, color: fg }]}>{text}</Text>;
}

// Recommended / emergency charging-stop card.
function StopCard({ analysis }) {
  if (!analysis || !analysis.needsStop || !analysis.best) return null;
  const b = analysis.best;

  if (analysis.emergency) {
    const battVal = b.arrivalBatt < 0 ? '0%' : `${b.arrivalBatt}%`;
    const deficit = b.belowMinBy > 0 ? b.belowMinBy : Math.max(0, -b.arrivalBatt);
    return (
      <View style={[s.stopWrap, { borderColor: '#c0392b' }]}>
        <View style={[s.stopHead, { backgroundColor: '#c0392b' }]}>
          <Text style={s.emoji}>🚨</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.kicker, { color: 'rgba(255,255,255,0.8)' }]}>PARAGEM DE EMERGÊNCIA</Text>
            <Text style={[s.stopName, { color: '#fff' }]} numberOfLines={1}>{b.station.name}</Text>
          </View>
          {b.occupiedPenaltyMin ? (
            <Text style={[s.occ, { color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)' }]}>⏳ ocupado</Text>
          ) : null}
        </View>
        <View style={[s.stopBody, { backgroundColor: '#fff8f8' }]}>
          <Chip bg="#ffe0e0" fg="#7a1818" text={`📍 ${b.distToStop} km`} />
          <Chip bg="#ffe0e0" fg="#7a1818" text={`🔋 ${battVal}`} />
          {deficit > 0 ? <Chip bg="#c0392b" fg="#fff" text={`⬇ −${deficit}%`} /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.stopWrap, { borderColor: '#f1c40f' }]}>
      <View style={[s.stopHead, { backgroundColor: '#f1c40f' }]}>
        <Text style={s.emoji}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: 'rgba(0,0,0,0.45)' }]}>PARAGEM RECOMENDADA</Text>
          <Text style={[s.stopName, { color: colors.navy }]} numberOfLines={1}>{b.station.name}</Text>
        </View>
        {b.occupiedPenaltyMin ? (
          <Text style={[s.occ, { color: '#6b4a00', backgroundColor: 'rgba(255,255,255,0.35)' }]}>⏳ ocupado</Text>
        ) : null}
      </View>
      <View style={[s.stopBody, { backgroundColor: '#fffbee' }]}>
        <Chip bg="#fff4c2" fg="#7a5e00" text={`📍 ${b.distToStop} km`} />
        <Chip bg="#fff4c2" fg="#7a5e00" text={`🔋 ${b.arrivalBatt}%`} />
        <Chip bg="#fff4c2" fg="#7a5e00" text={`⏱ ${b.chargeMin}min`} />
        <Chip bg="#fff4c2" fg="#7a5e00" text={`⚡ ${b.station.speed || '?'}kW`} />
      </View>
    </View>
  );
}

export default function RouteInfoCard({ route, onClear }) {
  const insets = useSafeAreaInsets();
  if (!route) return null;
  return (
    <View style={[s.card, { top: insets.top + 58 }]}>
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.dest} numberOfLines={1}>{route.destination?.name || 'Destino'}</Text>
          <Text style={s.sub}>{route.durationText} · {route.distanceText}</Text>
        </View>
        <TouchableOpacity style={s.clearBtn} onPress={onClear}>
          <Text style={s.clearTxt}>Limpar</Text>
        </TouchableOpacity>
      </View>
      <StopCard analysis={route.analysis} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    ...shadow.lg,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dest: { fontSize: 14, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 12, color: colors.text3, marginTop: 2 },
  clearBtn: {
    backgroundColor: colors.c4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  clearTxt: { color: colors.c2, fontWeight: '700', fontSize: 12 },

  stopWrap: { marginTop: 8, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5 },
  stopHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7 },
  emoji: { fontSize: 20 },
  kicker: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  stopName: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  occ: { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  stopBody: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  chip: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: 'hidden',
  },
});
