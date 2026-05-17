// Profile — ports #screen-profile. Vehicle card opens the edit sheet,
// the name is editable inline, preferences are local toggles.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import VehicleEditSheet from '../components/VehicleEditSheet';
import { useApp } from '../state/AppContext';
import { colors, radius, shadow } from '../theme/theme';
import { updateName } from '../services/auth';

function PrefRow({ label, value, onChange, last }) {
  return (
    <View style={[s.prefRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.prefLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.c2, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const m = user?.user_metadata || {};
  const name = m.name || user?.email?.split('@')[0] || 'Utilizador';
  const points = m.points || 0;

  const [prefs, setPrefs] = useState({ notif: true, dark: false, autoRoute: true });
  const set = (k) => (v) => setPrefs((p) => ({ ...p, [k]: v }));

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);

  const vehicle = [
    ['Marca', m.car_brand],
    ['Modelo', m.car_model],
    ['Ano', m.car_year],
    ['Matrícula', m.license_plate],
    ['Quilometragem', m.mileage ? `${m.mileage} km` : null],
    ['Conector', m.connector],
  ];

  function startEditName() {
    if (!user) {
      Alert.alert('Sessão', 'Inicia sessão no menu (☰) para editar o perfil.');
      return;
    }
    setNameInput(name);
    setEditingName(true);
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    setNameBusy(true);
    const res = await updateName(nameInput.trim());
    setNameBusy(false);
    if (res.error) {
      Alert.alert('Erro', res.error);
      return;
    }
    setEditingName(false);
  }

  function openVehicle() {
    if (!user) {
      Alert.alert('Sessão', 'Inicia sessão no menu (☰) para editar o veículo.');
      return;
    }
    setVehicleOpen(true);
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="Perfil" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.level}>Helper · {points} pts</Text>
          </View>
          <TouchableOpacity style={s.editBtn} onPress={startEditName}>
            <Text style={s.editIcon}>✎</Text>
          </TouchableOpacity>
        </View>

        {editingName ? (
          <View style={s.editNameRow}>
            <TextInput
              style={s.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Novo nome"
              placeholderTextColor={colors.c3}
            />
            <TouchableOpacity style={s.nameSave} onPress={saveName} disabled={nameBusy}>
              {nameBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.nameSaveTxt}>Guardar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.nameCancel} onPress={() => setEditingName(false)}>
              <Text style={s.nameCancelTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={s.sectionTitle}>Informação do Veículo</Text>
        <TouchableOpacity style={s.card} onPress={openVehicle} activeOpacity={0.7}>
          {vehicle.map(([k, v], i) => (
            <View key={i} style={[s.row, i === vehicle.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.rowK}>{k}</Text>
              <Text style={s.rowV}>{v != null && v !== '' ? String(v) : '--'}</Text>
            </View>
          ))}
          <Text style={s.editHint}>{user ? 'Tocar para editar' : 'Inicia sessão para editar'}</Text>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>Preferências</Text>
        <View style={s.card}>
          <PrefRow label="Notificações" value={prefs.notif} onChange={set('notif')} />
          <PrefRow label="Modo Escuro" value={prefs.dark} onChange={set('dark')} />
          <PrefRow label="Rota mais barata automática" value={prefs.autoRoute} onChange={set('autoRoute')} last />
        </View>
      </ScrollView>

      <VehicleEditSheet visible={vehicleOpen} onClose={() => setVehicleOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.c2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.navy },
  level: { fontSize: 13, color: colors.text2, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.c4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: { fontSize: 16, color: colors.c2 },

  editNameRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
  },
  nameSave: { backgroundColor: colors.c2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  nameSaveTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  nameCancel: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCancelTxt: { fontSize: 14, color: colors.text3 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.navy, marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow.card },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  rowK: { fontSize: 13, color: colors.text2 },
  rowV: { fontSize: 13, color: colors.navy, fontWeight: '500' },
  editHint: { fontSize: 11, color: colors.text3, textAlign: 'center', marginTop: 10 },

  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  prefLabel: { fontSize: 14, color: colors.navy },
});
