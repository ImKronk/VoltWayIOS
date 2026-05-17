// AI Predictions — ports #screen-prediction (hero gauge, hourly forecast,
// nearby prediction cards).
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { CircularGauge, BarChart } from '../components/Charts';
import { colors, radius, shadow } from '../theme/theme';
import { PREDICTIONS, HOURLY_FORECAST } from '../data/demo';

const CLS = {
  high: { bg: 'rgba(57,91,100,0.12)', fg: colors.c2, bar: colors.c2 },
  medium: { bg: 'rgba(222,215,78,0.18)', fg: '#9c8f1e', bar: colors.c3 },
  low: { bg: 'rgba(231,76,60,0.12)', fg: colors.red, bar: colors.red },
};

export default function PredictionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.container}>
      <ScreenHeader title="Predições AI" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <View style={s.hero}>
          <CircularGauge percent={75} size={150} value="75%" label="disponível" />
          <Text style={s.heroMain}>
            Alta probabilidade de um posto ficar livre em <Text style={{ fontWeight: '800' }}>20 minutos</Text>
          </Text>
          <Text style={s.heroSub}>Baseado em dados históricos e padrões atuais</Text>
        </View>

        <Text style={s.sectionTitle}>Previsão Horária</Text>
        <View style={s.card}>
          <BarChart labels={HOURLY_FORECAST.labels} data={HOURLY_FORECAST.data} height={150} />
        </View>

        <Text style={s.sectionTitle}>Predições por Perto</Text>
        {PREDICTIONS.map((p, i) => {
          const c = CLS[p.cls];
          return (
            <View key={i} style={s.predCard}>
              <View style={s.predTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.predName}>{p.name}</Text>
                  <Text style={s.predAddr}>{p.addr}</Text>
                </View>
                <View style={[s.predPct, { backgroundColor: c.bg }]}>
                  <Text style={[s.predPctTxt, { color: c.fg }]}>{p.prob}%</Text>
                </View>
              </View>
              <View style={s.predBar}>
                <View style={[s.predBarFill, { width: `${p.prob}%`, backgroundColor: c.bar }]} />
              </View>
              <View style={s.predMeta}>
                <Text style={s.predMetaTxt}>{p.txt}</Text>
                <Text style={s.predMetaTxt}>Espera: {p.wait}</Text>
              </View>
            </View>
          );
        })}

        <Text style={s.disclaimer}>⚠️ Dados de demonstração — não são previsões em tempo real.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  hero: { alignItems: 'center', paddingVertical: 10 },
  heroMain: { fontSize: 14, color: colors.navy, textAlign: 'center', marginTop: 14, lineHeight: 21, paddingHorizontal: 10 },
  heroSub: { fontSize: 12, color: colors.text3, marginTop: 4 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.navy, marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow.card },

  predCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 8, ...shadow.card },
  predTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  predName: { fontSize: 14, fontWeight: '600', color: colors.navy },
  predAddr: { fontSize: 11, color: colors.text3, marginTop: 1 },
  predPct: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  predPctTxt: { fontSize: 14, fontWeight: '800' },
  predBar: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  predBarFill: { height: '100%', borderRadius: 3 },
  predMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  predMetaTxt: { fontSize: 11, color: colors.text3 },

  disclaimer: { fontSize: 11, color: colors.text3, marginTop: 14, textAlign: 'center' },
});
