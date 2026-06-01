// Slide-in side menu — ports #sideMenu (login form when logged out,
// vehicle grid + menu + sign-out when logged in).
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, radius, shadow } from '../theme/theme';
import { signIn, signUp, signOut } from '../services/auth';

const WIDTH = 300;

const MENU = [
  { icon: '👤', label: 'Perfil & Veículo', screen: 'Profile' },
  { icon: '🔋', label: 'Bateria & Autonomia', screen: 'Battery' },
  { icon: '🏆', label: 'Leaderboard', screen: 'Leaderboard' },
  { icon: '👑', label: 'Plano Premium', screen: 'Premium' },
];

export default function SideMenu({ visible, onClose, navigation, onEditVehicle }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const tx = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Animated.timing(tx, { toValue: visible ? 0 : -WIDTH, duration: 260, useNativeDriver: true }).start();
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 260, useNativeDriver: true }).start();
  }, [visible, tx, fade]);

  const m = user?.user_metadata || {};
  const name = m.name || user?.email?.split('@')[0] || 'Convidado';
  const initials = name.slice(0, 2).toUpperCase();

  const go = (screen) => {
    onClose();
    navigation.navigate(screen);
  };

  async function handleLogin() {
    setError('');
    setInfo('');
    if (!email.trim() || !password) {
      setError('Preenche email e password.');
      return;
    }
    setBusy(true);
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEmail('');
    setPassword('');
  }

  async function handleSignup() {
    setError('');
    setInfo('');
    if (!email.trim() || !password) {
      setError('Preenche email e password.');
      return;
    }
    if (password.length < 6) {
      setError('A password precisa de 6+ caracteres.');
      return;
    }
    setBusy(true);
    const res = await signUp(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInfo('Conta criada! Confirma o email para entrares.');
  }

  async function handleLogout() {
    await signOut();
    onClose();
  }

  const VEHICLE = [
    ['Marca', m.car_brand],
    ['Modelo', m.car_model],
    ['Ano', m.car_year],
    ['Matrícula', m.license_plate],
    ['Km', m.mileage],
    ['Conector', m.connector],
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[s.overlay, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.panel, { transform: [{ translateX: tx }] }]}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 30 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!user ? (
            <View>
              <View style={s.loginHero}>
                <View style={s.loginIcon}>
                  <Text style={{ fontSize: 34 }}>⚡</Text>
                </View>
                <Text style={s.loginTitle}>VoltWay</Text>
                <Text style={s.loginSub}>Inicia sessão para todas as funcionalidades</Text>
              </View>
              <View style={s.form}>
                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor={colors.c3}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={s.input}
                  placeholder="Password"
                  placeholderTextColor={colors.c3}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <TouchableOpacity style={s.primaryBtn} onPress={handleLogin} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.primaryBtnTxt}>Entrar</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={handleSignup} disabled={busy}>
                  <Text style={s.secondaryBtnTxt}>Criar Conta</Text>
                </TouchableOpacity>
                {error ? <Text style={s.error}>{error}</Text> : null}
                {info ? <Text style={s.info}>{info}</Text> : null}
              </View>
            </View>
          ) : (
            <View>
              <View style={s.head}>
                <View style={s.avatar}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{name}</Text>
                  <Text style={s.sub}>Helper · {m.points || 0} pts</Text>
                </View>
              </View>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>O MEU VEÍCULO</Text>
              <TouchableOpacity
                style={s.vehicleGrid}
                onPress={() => {
                  onClose();
                  onEditVehicle();
                }}
              >
                {VEHICLE.map(([k, v], i) => (
                  <View key={i} style={s.vehicleCell}>
                    <Text style={s.vLabel}>{k}</Text>
                    <Text style={s.vValue} numberOfLines={1}>
                      {v != null && v !== '' ? String(v) : '--'}
                    </Text>
                  </View>
                ))}
              </TouchableOpacity>
              <Text style={s.editHint}>Tocar para editar veículo</Text>
            </View>
          )}

          <View style={s.divider} />
          {MENU.map((item) => (
            <TouchableOpacity key={item.screen} style={s.item} onPress={() => go(item.screen)}>
              <Text style={s.itemIcon}>{item.icon}</Text>
              <Text style={s.itemLabel}>{item.label}</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          {user ? (
            <View>
              <View style={s.divider} />
              <TouchableOpacity style={s.item} onPress={handleLogout}>
                <Text style={s.itemIcon}>🚪</Text>
                <Text style={[s.itemLabel, { color: colors.red }]}>Terminar Sessão</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,40,56,0.45)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: colors.card,
    ...shadow.lg,
  },

  // login
  loginHero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  loginIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.c4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  loginTitle: { fontSize: 22, fontWeight: '800', color: colors.navy },
  loginSub: { fontSize: 12, color: colors.text3, textAlign: 'center', marginTop: 4 },
  form: { paddingHorizontal: 20 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: colors.c2,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.c2,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnTxt: { color: colors.c2, fontSize: 14, fontWeight: '600' },
  error: { color: colors.red, fontSize: 12, textAlign: 'center', marginTop: 10 },
  info: { color: colors.c2, fontSize: 12, textAlign: 'center', marginTop: 10 },

  // logged in
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 6 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.c2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 12, color: colors.c2, marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.text3, letterSpacing: 0.5, paddingHorizontal: 20, marginBottom: 6 },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
  },
  vehicleCell: { width: '33.33%', paddingHorizontal: 6, paddingVertical: 5 },
  vLabel: { fontSize: 10, color: colors.text3 },
  vValue: { fontSize: 13, fontWeight: '600', color: colors.navy },
  editHint: { fontSize: 11, color: colors.text3, paddingHorizontal: 20, marginTop: 4 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13 },
  itemIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.navy },
  chevron: { fontSize: 18, color: colors.text3 },
});
