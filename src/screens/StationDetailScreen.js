// Station detail — ports showDetail() from app.js (core fields).
// Community reports + hourly chart are Phase 2.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, radius, shadow } from '../theme/theme';
import { fmtPrice, fmtSpeed, fmtSpeedShort } from '../utils/format';
import { referencePrice } from '../data/pricing';

const STATUS = {
  available: { label: 'Disponível', bg: 'rgba(57,91,100,0.12)', fg: colors.c2 },
  occupied: { label: 'Ocupado', bg: 'rgba(231,76,60,0.12)', fg: colors.red },
  broken: { label: 'Avariado', bg: 'rgba(245,158,11,0.16)', fg: '#b45309' },
  unavailable: { label: 'Indisponível', bg: 'rgba(142,155,174,0.18)', fg: colors.text3 },
  unknown: { label: 'Estado desconhecido', bg: 'rgba(142,155,174,0.14)', fg: colors.text3 },
};

function Stat({ val, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statVal}>{val}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ k, v }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={s.rowV}>{v}</Text>
    </View>
  );
}

export default function StationDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { setSelectedStation } = useApp();
  const st = route.params?.station;

  if (!st) {
    navigation.goBack();
    return null;
  }

  const status = STATUS[st.status] || STATUS.unknown;
  const ref = referencePrice(st);
  const hasRealPrice = st.price != null;
  const refEur = ref && ref.eur != null ? ref.eur : null;

  const startNav = () => {
    setSelectedStation(st);
    navigation.navigate('Route');
  };

  return (
    <View style={s.container}>
      <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.heroIcon}>⚡</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.name}>{st.name}</Text>

        <Text style={s.price}>
          {hasRealPrice ? (
            <Text style={s.priceStrong}>{fmtPrice(st)}</Text>
          ) : refEur != null ? (
            <Text style={s.priceStrong}>≈ €{refEur.toFixed(2)}</Text>
          ) : (
            <Text style={s.priceStrong}>n/d</Text>
          )}
          <Text> / kWh</Text>
          {!hasRealPrice && refEur != null ? <Text style={s.refTag}>  (ref.)</Text> : null}
        </Text>

        <View style={[s.badge, { backgroundColor: status.bg }]}>
          <Text style={[s.badgeTxt, { color: status.fg }]}>{status.label}</Text>
        </View>

        <Text style={s.meta}>
          {fmtSpeed(st)}   ·   {st.chargers} {st.chargers === 1 ? 'carregador' : 'carregadores'}   ·   {st.dist || '—'}
        </Text>

        <View style={s.statsGrid}>
          <Stat
            val={hasRealPrice ? fmtPrice(st) : refEur != null ? `≈€${refEur.toFixed(2)}` : 'n/d'}
            label="por kWh"
          />
          <Stat val={fmtSpeedShort(st)} label="Velocidade" />
          <Stat val={String(st.chargers)} label="Carregadores" />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Informação da estação</Text>
          <Row k="Morada" v={st.addr} />
          <Row k="Operador" v={st.operator || 'n/d'} />
          <View style={s.connRow}>
            <Text style={s.rowK}>Conectores</Text>
            <View style={s.chipsWrap}>
              {st.connectors && st.connectors.length ? (
                st.connectors.map((c, i) => (
                  <Text key={i} style={s.connChip}>{c}</Text>
                ))
              ) : (
                <Text style={s.rowV}>n/d</Text>
              )}
            </View>
          </View>
          <Text style={s.source}>Dados de Open Charge Map</Text>
        </View>

        {!hasRealPrice && ref ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Tarifa de referência</Text>
            {refEur != null ? (
              <Row
                k={ref.tier === 'dc' ? 'DC rápido (≥43 kW)' : 'AC normal (<43 kW)'}
                v={`€${refEur.toFixed(2)} / kWh`}
              />
            ) : (
              <Text style={s.rowV}>{ref.src}</Text>
            )}
            <Text style={s.source}>
              Fonte: {ref.src}
              {ref.url ? (
                <Text style={s.link} onPress={() => Linking.openURL(ref.url)}>  · tarifa atual</Text>
              ) : null}
            </Text>
          </View>
        ) : null}

        <View style={s.card}>
          <Text style={s.cardTitle}>Previsão (estimativa)</Text>
          <Row k="Disponibilidade prevista" v={`~${st.pred}% em 15 min`} />
          <Text style={s.source}>
            ⚠️ Estimativa baseada em padrões médios — não em dados em tempo real.
          </Text>
        </View>

        <TouchableOpacity style={s.cta} onPress={startNav} activeOpacity={0.9}>
          <Text style={s.ctaTxt}>Iniciar Navegação  →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: {
    height: 170,
    backgroundColor: colors.c2,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: { fontSize: 56 },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 48,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { color: '#fff', fontSize: 20, fontWeight: '700' },

  name: { fontSize: 22, fontWeight: '800', color: colors.navy },
  price: { fontSize: 16, color: colors.text2, marginTop: 4 },
  priceStrong: { fontSize: 20, fontWeight: '800', color: colors.navy },
  refTag: { fontSize: 11, color: colors.text3 },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  badgeTxt: { fontSize: 13, fontWeight: '600' },

  meta: { fontSize: 13, color: colors.text2, marginTop: 10 },

  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statVal: { fontSize: 17, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 10, color: colors.text3, marginTop: 3, textTransform: 'uppercase' },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 12,
    ...shadow.card,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  rowK: { fontSize: 13, color: colors.text2 },
  rowV: { fontSize: 13, color: colors.navy, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  connRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: '65%' },
  connChip: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.c2,
    backgroundColor: colors.c4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  source: { fontSize: 11, color: colors.text3, marginTop: 8 },
  link: { color: colors.c2, textDecorationLine: 'underline' },

  cta: {
    backgroundColor: colors.c2,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
