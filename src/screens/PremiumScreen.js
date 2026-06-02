// VoltWay Premium — upsell + subscription toggle, and the premium-gated
// automatic car-battery sync. NOTE: the live car sync shown here is a DEMO.
// A real integration needs a vehicle-data provider (Smartcar / Enode / the
// carmaker API) connected to the user's car account — see notes in chat.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { useApp } from '../state/AppContext';
import { colors, radius, shadow } from '../theme/theme';

const BENEFITS = [
  { icon: '🔋', title: 'Sincronização automática da bateria', sub: 'Liga o carro e a % entra sozinha na app' },
  { icon: '🚗', title: 'Integração CarPlay', sub: 'A VoltWay no ecrã do carro' },
  { icon: '🔮', title: 'Predições AI avançadas', sub: 'Disponibilidade de postos em tempo real' },
  { icon: '🗺️', title: 'Rotas premium ilimitadas', sub: 'Sem limites de planeamento' },
  { icon: '🚫', title: 'Sem anúncios', sub: 'Experiência totalmente limpa' },
];

export default function PremiumScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { premium, setPremium, batteryPrefs, setBatteryPrefs } = useApp();

  const [syncing, setSyncing] = useState(false);
  const [carSoc, setCarSoc] = useState(null);

  // DEMO car sync — simulates reading the car's state-of-charge and feeds it
  // into the app's battery prefs. Replace with a real vehicle-API call.
  function syncCar() {
    setSyncing(true);
    setTimeout(() => {
      const soc = Math.floor(68 + Math.random() * 22); // simulated %
      setBatteryPrefs({ ...batteryPrefs, currentBatt: soc });
      setCarSoc(soc);
      setSyncing(false);
    }, 1400);
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="VoltWay Premium" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.crown}>👑</Text>
          <Text style={s.heroTitle}>VoltWay Premium</Text>
          <Text style={s.heroSub}>
            {premium ? 'A tua subscrição está ativa.' : 'Desbloqueia tudo o que a VoltWay tem para oferecer.'}
          </Text>
          {!premium ? <Text style={s.price}>2,99 € <Text style={s.priceMo}>/ mês</Text></Text> : null}
          {premium ? (
            <View style={s.activeBadge}>
              <Text style={s.activeBadgeTxt}>✓ Premium ativo</Text>
            </View>
          ) : null}
        </View>

        {/* Benefits */}
        <Text style={s.sectionTitle}>O que inclui</Text>
        <View style={s.card}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={[s.benefitRow, i === BENEFITS.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.benefitIcon}>{b.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.benefitTitle}>{b.title}</Text>
                <Text style={s.benefitSub}>{b.sub}</Text>
              </View>
              {premium ? <Text style={s.benefitCheck}>✓</Text> : <Text style={s.benefitLock}>🔒</Text>}
            </View>
          ))}
        </View>

        {/* Car battery sync (premium only) */}
        <Text style={s.sectionTitle}>Sincronização do carro</Text>
        <View style={s.card}>
          {premium ? (
            <>
              <View style={s.carRow}>
                <Text style={s.carIcon}>🔋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.carTitle}>Bateria do carro</Text>
                  <Text style={s.carSub}>
                    {carSoc != null ? `Sincronizado · ${carSoc}%` : 'Ainda não ligado'}
                  </Text>
                </View>
                {carSoc != null ? <Text style={s.carPct}>{carSoc}%</Text> : null}
              </View>
              <TouchableOpacity style={s.syncBtn} onPress={syncCar} disabled={syncing} activeOpacity={0.85}>
                {syncing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.syncBtnTxt}>{carSoc != null ? 'Sincronizar de novo' : 'Ligar o meu carro'}</Text>
                )}
              </TouchableOpacity>
              <Text style={s.demoNote}>
                Demo — a sincronização real requer ligar a conta do carro (CarPlay/Smartcar).
              </Text>
            </>
          ) : (
            <View style={s.lockedSync}>
              <Text style={s.carIcon}>🔒</Text>
              <Text style={s.lockedTxt}>Disponível no plano Premium.</Text>
            </View>
          )}
        </View>

        {/* CTA */}
        {!premium ? (
          <TouchableOpacity style={s.cta} onPress={() => setPremium(true)} activeOpacity={0.9}>
            <Text style={s.ctaTxt}>Obter Premium</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.cancel} onPress={() => setPremium(false)} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Cancelar subscrição</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  hero: {
    backgroundColor: colors.c2,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    ...shadow.card,
  },
  crown: { fontSize: 44 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 8 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  price: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 14 },
  priceMo: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  activeBadge: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeBadgeTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.navy, marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 8, ...shadow.card },

  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  benefitIcon: { fontSize: 24, width: 28, textAlign: 'center' },
  benefitTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  benefitSub: { fontSize: 12, color: colors.text2, marginTop: 2 },
  benefitCheck: { fontSize: 16, fontWeight: '800', color: colors.green },
  benefitLock: { fontSize: 14 },

  carRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 10 },
  carIcon: { fontSize: 24, width: 28, textAlign: 'center' },
  carTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  carSub: { fontSize: 12, color: colors.text2, marginTop: 2 },
  carPct: { fontSize: 20, fontWeight: '800', color: colors.c2 },
  syncBtn: {
    backgroundColor: colors.c2,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginHorizontal: 10,
    marginTop: 4,
  },
  syncBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  demoNote: { fontSize: 11, color: colors.text3, textAlign: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, lineHeight: 16 },

  lockedSync: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  lockedTxt: { fontSize: 14, color: colors.text2, fontWeight: '600' },

  cta: {
    marginTop: 22,
    backgroundColor: colors.c2,
    borderRadius: radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    ...shadow.card,
  },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancel: { marginTop: 22, paddingVertical: 14, alignItems: 'center' },
  cancelTxt: { color: colors.red, fontSize: 14, fontWeight: '700' },
});
