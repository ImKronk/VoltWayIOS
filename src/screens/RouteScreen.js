// Route options — ports #screen-route (battery sliders, recommended stops,
// "Find Best Route"). Computes the route then hands it to the map.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, radius, shadow } from '../theme/theme';
import { fmtPrice, fmtSpeedShort } from '../utils/format';
import { planRoute } from '../services/routing';

export default function RouteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const app = useApp();
  const {
    location, stations, connector, keys, batteryPrefs, setBatteryPrefs, selectedStation, setRoute,
  } = app;

  const [batt, setBatt] = useState(batteryPrefs.currentBatt);
  const [minBatt, setMinBatt] = useState(batteryPrefs.minBatt);
  const [maxDist, setMaxDist] = useState(batteryPrefs.maxDist);
  const [busy, setBusy] = useState(false);

  const belowLimit = batt <= minBatt;

  // Recommended stops — ported from renderRec() (price-safe for null OCM prices).
  const recommended = [...stations]
    .filter((s) => s.status !== 'occupied')
    .sort(
      (a, b) =>
        b.pred * 0.4 + (1 - (b.price ?? 0.5)) * 30 - (a.pred * 0.4 + (1 - (a.price ?? 0.5)) * 30),
    )
    .slice(0, 3);

  async function compute() {
    if (!selectedStation) {
      Alert.alert('Destino', 'Escolhe primeiro um posto no mapa para definir o destino.');
      return;
    }
    const prefs = { currentBatt: batt, minBatt, maxDist };
    setBatteryPrefs(prefs);
    setBusy(true);
    try {
      const res = await planRoute(
        { lat: selectedStation.lat, lng: selectedStation.lng, name: selectedStation.name },
        { stations, origin: location, batteryPrefs: prefs, userConnector: connector, orsKey: keys.ors },
      );
      if (!res.ok) {
        Alert.alert('Rota', res.error);
        return;
      }
      setRoute(res.route);
      navigation.navigate('Map');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Falha ao calcular a rota.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Opções de Rota</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        {/* Destination */}
        <View style={s.destCard}>
          <Text style={s.destPin}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.destLabel}>DESTINO</Text>
            <Text style={s.destName} numberOfLines={1}>
              {selectedStation ? selectedStation.name : 'Nenhum posto escolhido'}
            </Text>
          </View>
        </View>

        {/* Current battery */}
        <View style={s.sliderGroup}>
          <View style={s.sliderLabel}>
            <Text style={s.sliderLabelTxt}>🔋 Bateria Atual</Text>
            <Text style={[s.sliderVal, belowLimit && { color: colors.red }]}>{batt}%</Text>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={batt}
            onValueChange={setBatt}
            minimumTrackTintColor={colors.c2}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.c2}
          />
        </View>

        {/* Minimum battery limit */}
        <View style={s.sliderGroup}>
          <View style={s.sliderLabel}>
            <Text style={s.sliderLabelTxt}>⚠️ Limite Mínimo de Bateria</Text>
            <Text style={s.sliderVal}>{minBatt}%</Text>
          </View>
          <Slider
            minimumValue={5}
            maximumValue={50}
            step={1}
            value={minBatt}
            onValueChange={setMinBatt}
            minimumTrackTintColor={colors.red}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.red}
          />
          <View style={s.info}>
            <Text style={s.infoTxt}>
              A rota inclui uma paragem de carregamento antes de a bateria descer abaixo de{' '}
              <Text style={{ fontWeight: '700' }}>{minBatt}%</Text>.
            </Text>
          </View>
        </View>

        {belowLimit ? (
          <View style={s.warning}>
            <Text style={s.warningTxt}>⚠️ A bateria atual está abaixo do limite mínimo!</Text>
          </View>
        ) : null}

        {/* Max distance */}
        <View style={s.sliderGroup}>
          <View style={s.sliderLabel}>
            <Text style={s.sliderLabelTxt}>Distância Máxima</Text>
            <Text style={s.sliderVal}>{maxDist} km</Text>
          </View>
          <Slider
            minimumValue={5}
            maximumValue={300}
            step={5}
            value={maxDist}
            onValueChange={setMaxDist}
            minimumTrackTintColor={colors.c2}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.c2}
          />
        </View>

        {/* Connector (read-only, from profile) */}
        <View style={s.optionRow}>
          <Text style={s.optionLabel}>🔌 Conector</Text>
          <Text style={s.optionVal}>{connector || 'Todos (sem perfil)'}</Text>
        </View>

        {/* Recommended stops */}
        <Text style={s.sectionTitle}>Postos Recomendados</Text>
        {recommended.map((st, i) => (
          <TouchableOpacity
            key={String(st.id)}
            style={s.recCard}
            onPress={() => navigation.navigate('StationDetail', { station: st })}
          >
            <View style={s.recRank}>
              <Text style={s.recRankTxt}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.recName} numberOfLines={1}>{st.name}</Text>
              <Text style={s.recMeta}>
                {st.dist || '—'} · {fmtSpeedShort(st)} · {fmtPrice(st)}
              </Text>
            </View>
            <Text style={s.recScore}>{st.pred}%</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={s.cta} onPress={compute} disabled={busy} activeOpacity={0.9}>
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.ctaTxt}>Encontrar Melhor Rota  →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: colors.navy },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.navy },

  destCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.c4,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  destPin: { fontSize: 20 },
  destLabel: { fontSize: 11, color: colors.text3, fontWeight: '700', letterSpacing: 0.5 },
  destName: { fontSize: 14, color: colors.navy, fontWeight: '600', marginTop: 2 },

  sliderGroup: { marginBottom: 18 },
  sliderLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sliderLabelTxt: { fontSize: 14, color: colors.navy, fontWeight: '500' },
  sliderVal: { fontSize: 14, fontWeight: '700', color: colors.c2 },

  info: {
    marginTop: 6,
    backgroundColor: colors.c4,
    borderWidth: 1,
    borderColor: colors.c3,
    borderRadius: 10,
    padding: 10,
  },
  infoTxt: { fontSize: 11, color: colors.c2, lineHeight: 16 },

  warning: {
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  warningTxt: { fontSize: 12, fontWeight: '600', color: colors.red },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: { fontSize: 14, color: colors.navy, fontWeight: '500' },
  optionVal: { fontSize: 13, color: colors.text2, fontWeight: '600' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.navy, marginTop: 20, marginBottom: 10 },

  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 6,
    ...shadow.card,
  },
  recRank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.c2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recRankTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  recName: { fontSize: 13, fontWeight: '600', color: colors.navy },
  recMeta: { fontSize: 11, color: colors.text2, marginTop: 2 },
  recScore: { fontSize: 14, fontWeight: '800', color: colors.c2 },

  ctaWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    backgroundColor: colors.c2,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
