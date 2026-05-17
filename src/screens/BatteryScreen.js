// Battery & Range — ports #screen-battery (radial gauge, stats,
// consumption chart, driving analysis, AI insight).
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { CircularGauge, AreaChart } from '../components/Charts';
import { colors, radius, shadow } from '../theme/theme';
import { BATTERY } from '../data/demo';

export default function BatteryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.container}>
      <ScreenHeader title="Bateria & Autonomia" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <View style={s.hero}>
          <CircularGauge percent={BATTERY.level} size={180} value={`${BATTERY.level}%`} label="Bateria" />
        </View>

        <View style={s.statsRow}>
          {BATTERY.stats.map((st, i) => (
            <View key={i} style={s.statCard}>
              <Text style={s.statVal}>{st.val}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Consumo de Energia</Text>
        <View style={s.card}>
          <AreaChart data={BATTERY.consumption} labels={BATTERY.consumptionLabels} height={140} color={colors.c2} />
        </View>

        <Text style={s.sectionTitle}>Análise de Condução</Text>
        <View style={s.card}>
          {BATTERY.driving.map((d, i) => (
            <View key={i} style={[s.barRow, i === BATTERY.driving.length - 1 && { marginBottom: 0 }]}>
              <Text style={s.barLabel}>{d.label}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${d.pct}%`, backgroundColor: d.color }]} />
              </View>
              <Text style={s.barVal}>{d.val}</Text>
            </View>
          ))}
        </View>

        <View style={s.insight}>
          <Text style={{ fontSize: 20 }}>💡</Text>
          <Text style={s.insightTxt}>
            <Text style={{ fontWeight: '700' }}>Insight AI: </Text>
            Com o teu padrão de condução, carrega aos <Text style={{ fontWeight: '700' }}>25%</Text> de
            bateria para saúde ótima. Próximo carregamento em <Text style={{ fontWeight: '700' }}>~45 km</Text>.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  hero: { alignItems: 'center', paddingVertical: 8 },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', ...shadow.card },
  statVal: { fontSize: 16, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 10, color: colors.text3, marginTop: 3, textTransform: 'uppercase' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.navy, marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow.card },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  barLabel: { fontSize: 12, color: colors.text2, width: 90 },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barVal: { fontSize: 13, fontWeight: '700', color: colors.navy, width: 56, textAlign: 'right' },

  insight: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(57,91,100,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(165,201,202,0.4)',
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 12,
  },
  insightTxt: { flex: 1, fontSize: 13, color: colors.navy, lineHeight: 19 },
});
