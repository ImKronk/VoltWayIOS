// Vehicle edit modal — ports #vehicleSheet. Saves to the user's auth
// metadata via Supabase. Requires an authenticated user.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, radius } from '../theme/theme';
import { updateVehicle } from '../services/auth';

const CONNECTORS = ['CCS2', 'CHAdeMO', 'Type 2', 'Tesla'];

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={colors.c3} {...props} />
    </View>
  );
}

export default function VehicleEditSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const m = user?.user_metadata || {};

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [mileage, setMileage] = useState('');
  const [connector, setConnector] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Pre-fill each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setBrand(m.car_brand || '');
      setModel(m.car_model || '');
      setYear(m.car_year ? String(m.car_year) : '');
      setPlate(m.license_plate || '');
      setMileage(m.mileage ? String(m.mileage) : '');
      setConnector(m.connector || '');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    setError('');
    setBusy(true);
    const res = await updateVehicle({
      car_brand: brand.trim(),
      car_model: model.trim(),
      car_year: parseInt(year, 10) || null,
      license_plate: plate.trim(),
      mileage: parseInt(mileage, 10) || null,
      connector,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.handle} />
            <Text style={s.title}>Editar Veículo</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
              <Field label="Marca" value={brand} onChangeText={setBrand} placeholder="ex. Tesla" />
              <Field label="Modelo" value={model} onChangeText={setModel} placeholder="ex. Model 3 Long Range" />
              <Field
                label="Ano"
                value={year}
                onChangeText={setYear}
                placeholder="ex. 2023"
                keyboardType="number-pad"
              />
              <Field
                label="Matrícula"
                value={plate}
                onChangeText={setPlate}
                placeholder="ex. AB-12-CD"
                autoCapitalize="characters"
              />
              <Field
                label="Quilometragem (km)"
                value={mileage}
                onChangeText={setMileage}
                placeholder="ex. 24500"
                keyboardType="number-pad"
              />
              <Text style={s.fieldLabel}>Conector</Text>
              <View style={s.connectorRow}>
                {CONNECTORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.connChip, connector === c && s.connChipActive]}
                    onPress={() => setConnector(c)}
                  >
                    <Text style={[s.connChipTxt, connector === c && s.connChipTxtActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {error ? <Text style={s.error}>{error}</Text> : null}
            </ScrollView>
            <TouchableOpacity style={s.saveBtn} onPress={save} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnTxt}>Guardar Alterações</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(27,40,56,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.navy, marginBottom: 12 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.text3, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  connectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 4 },
  connChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  connChipActive: { backgroundColor: colors.c2, borderColor: colors.c2 },
  connChipTxt: { fontSize: 12, fontWeight: '600', color: colors.c2 },
  connChipTxtActive: { color: '#fff' },
  error: { color: colors.red, fontSize: 12, marginTop: 8, textAlign: 'center' },

  saveBtn: {
    backgroundColor: colors.c2,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
