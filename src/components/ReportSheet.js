// Community report panel — a draggable bottom sheet (@gorhom/bottom-sheet).
// Opens for the station the user picked on the map and lets them report
// its status. Drag up/down between snap points, swipe to dismiss.
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, radius } from '../theme/theme';
import { submitReport } from '../services/reports';
import { estimateOccupiedMinutes } from '../services/stationStatus';
import { COMMUNITY_STATS, RECENT_REPORTS } from '../data/demo';

const OPTIONS = [
  { status: 'available', label: 'Disponível', icon: '⚡' },
  { status: 'occupied', label: 'Ocupado', icon: '⛔' },
  { status: 'broken', label: 'Avariado', icon: '⚠️' },
  { status: 'unavailable', label: 'Indisponível', icon: '🚫' },
];

export default function ReportSheet({ visible, station, onClose }) {
  const insets = useSafeAreaInsets();
  const { user, reportStation } = useApp();
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ['68%', '92%'], []);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  // Open / close the sheet to follow the `visible` prop.
  useEffect(() => {
    if (visible) {
      setDone(null);
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  async function report(status) {
    if (!user) {
      setDone({ error: 'Inicia sessão no menu para reportar.' });
      return;
    }
    if (!station) return;
    setBusy(true);
    await submitReport(station.id, status, user);
    reportStation(station.id, status);
    setBusy(false);
    let msg = '✓ Reporte registado! +10 pontos';
    if (status === 'occupied') {
      msg = `✓ Ocupado · estimámos livre em ~${estimateOccupiedMinutes(station)} min`;
    } else if (status === 'available') {
      msg = '✓ Disponível registado! +10 pontos';
    }
    setDone({ ok: true, msg });
    setTimeout(() => {
      setDone(null);
      onClose();
    }, 1800);
  }

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={s.sheetBg}
      handleIndicatorStyle={s.handle}
    >
      <BottomSheetScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={s.hero}>
          <Text style={s.heroTitle}>Ajuda a Comunidade</Text>
          <Text style={s.heroSub}>Atualiza o estado dos postos e ganha pontos!</Text>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>{COMMUNITY_STATS.updatesToday}</Text>
              <Text style={s.statLabel}>Hoje</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statNum}>{COMMUNITY_STATS.accuracy}%</Text>
              <Text style={s.statLabel}>Precisão</Text>
            </View>
          </View>
        </View>

        <Text style={s.section}>Qual é o estado deste posto?</Text>
        <Text style={s.stationName} numberOfLines={2}>
          📍 {station?.name || '—'}
          {station?.dist ? `   ·   ${station.dist}` : ''}
        </Text>

        <View style={s.grid}>
          {OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.status}
              style={s.option}
              onPress={() => report(o.status)}
              disabled={busy || !station}
              activeOpacity={0.7}
            >
              <Text style={s.optionIcon}>{o.icon}</Text>
              <Text style={s.optionLabel}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {busy ? <ActivityIndicator color={colors.c2} style={{ marginTop: 12 }} /> : null}
        {done?.ok ? <Text style={s.toastOk}>{done.msg}</Text> : null}
        {done?.error ? <Text style={s.toastErr}>{done.error}</Text> : null}

        <Text style={s.section}>Reportes Recentes</Text>
        {RECENT_REPORTS.map((r, i) => (
          <View key={i} style={s.reportRow}>
            <View style={s.rAvatar}>
              <Text style={s.rAvatarTxt}>{r.initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rName}>{r.name}</Text>
              <Text style={s.rDesc}>
                {r.station} — {r.statusEmoji}
              </Text>
            </View>
            <Text style={s.rTime}>{r.time}</Text>
          </View>
        ))}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  sheetBg: { backgroundColor: colors.card, borderRadius: 28 },
  handle: { backgroundColor: colors.c3, width: 44, height: 5 },
  content: { paddingHorizontal: 20, paddingTop: 4 },

  hero: {
    backgroundColor: colors.c2,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 40 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  section: { fontSize: 15, fontWeight: '800', color: colors.navy, marginTop: 20, marginBottom: 8 },
  stationName: { fontSize: 15, color: colors.navy, fontWeight: '700', marginBottom: 14, lineHeight: 21 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.c4,
  },
  optionIcon: { fontSize: 30 },
  optionLabel: { fontSize: 14, fontWeight: '700', color: colors.navy },

  toastOk: {
    marginTop: 12,
    backgroundColor: 'rgba(57,91,100,0.08)',
    color: colors.c2,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  toastErr: {
    marginTop: 12,
    backgroundColor: 'rgba(231,76,60,0.08)',
    color: colors.red,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },

  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  rAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(57,91,100,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rAvatarTxt: { fontSize: 14, fontWeight: '700', color: colors.c2 },
  rName: { fontSize: 13, fontWeight: '700', color: colors.navy },
  rDesc: { fontSize: 12, color: colors.text2 },
  rTime: { fontSize: 11, color: colors.text3 },
});
