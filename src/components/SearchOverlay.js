// Full-screen destination search — shared by the Map (home) and Navigation
// screens so both look and behave identically. Manages its own autocomplete,
// recent-search history, and submit/geocode fallback. On pick it persists the
// recent, closes, and hands the destination back via onSelect({lat,lng,name}).
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Keyboard,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors } from '../theme/theme';
import { autocompleteAddress } from '../services/geocode';
import { loadRecentSearches, addRecentSearch } from '../services/recentSearches';

export default function SearchOverlay({ visible, onClose, onSelect, placeholder = 'Para onde vais?' }) {
  const insets = useSafeAreaInsets();
  const { keys, location } = useApp();
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [recents, setRecents] = useState([]);
  const debounce = useRef(null);

  useEffect(() => {
    if (visible) {
      setQ('');
      setSugg([]);
      loadRecentSearches().then(setRecents);
    }
  }, [visible]);

  if (!visible) return null;

  function onChange(text) {
    setQ(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 3) {
      setSugg([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      const r = await autocompleteAddress(text, keys.ors, location);
      setSugg(r);
    }, 300);
  }

  function pick(dest) {
    if (debounce.current) clearTimeout(debounce.current);
    Keyboard.dismiss();
    const d = { lat: dest.lat, lng: dest.lng, name: dest.name };
    addRecentSearch(recents, d).then(setRecents);
    onClose();
    onSelect(d);
  }

  async function submit() {
    const text = q.trim();
    if (text.length < 3) return;
    if (sugg.length) {
      pick(sugg[0]);
      return;
    }
    try {
      const r = await Location.geocodeAsync(text);
      if (r && r.length) pick({ lat: r[0].latitude, lng: r[0].longitude, name: text });
      else Alert.alert('Destino', 'Não foi possível encontrar esse local.');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Falha na pesquisa.');
    }
  }

  return (
    <View style={[s.overlay, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={s.back}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <View style={s.inputWrap}>
          <Text style={s.icon}>🔍</Text>
          <TextInput
            style={s.input}
            value={q}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.text3}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={submit}
          />
          {q.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setQ('');
                setSugg([]);
              }}
              hitSlop={10}
            >
              <Text style={s.clear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {sugg.length > 0 ? (
          sugg.map((sg, i) => (
            <TouchableOpacity
              key={`${sg.lat},${sg.lng},${i}`}
              style={s.row}
              onPress={() => pick(sg)}
              activeOpacity={0.6}
            >
              <Text style={s.rowIcon}>📍</Text>
              <Text style={s.rowTxt} numberOfLines={2}>{sg.name}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <>
            <Text style={s.label}>RECENTES</Text>
            {recents.length ? (
              recents.map((r, i) => (
                <TouchableOpacity
                  key={`${r.lat},${r.lng},${i}`}
                  style={s.row}
                  onPress={() => pick(r)}
                  activeOpacity={0.6}
                >
                  <Text style={s.rowIcon}>🕘</Text>
                  <Text style={s.rowTxt} numberOfLines={1}>{r.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={s.empty}>As tuas pesquisas recentes aparecem aqui.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', paddingHorizontal: 16, zIndex: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  back: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 30, color: colors.navy, fontWeight: '700', marginTop: -4 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icon: { fontSize: 17 },
  input: { flex: 1, fontSize: 16, color: colors.navy, padding: 0, fontWeight: '500' },
  clear: { fontSize: 15, color: colors.text3, fontWeight: '800' },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text3,
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 6,
  },
  empty: { fontSize: 14, color: colors.text3, paddingHorizontal: 6, paddingTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  rowIcon: { fontSize: 18 },
  rowTxt: { flex: 1, fontSize: 15, color: colors.navy, fontWeight: '500' },
});
