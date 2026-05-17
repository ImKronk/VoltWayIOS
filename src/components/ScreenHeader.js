// Shared sub-screen header — back button + centred title + optional right slot.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';

export default function ScreenHeader({ title, navigation, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity style={s.side} onPress={() => navigation.goBack()}>
        <Text style={s.back}>←</Text>
      </TouchableOpacity>
      <Text style={s.title}>{title}</Text>
      <View style={s.side}>{right || null}</View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  side: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 24, color: colors.navy },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.navy },
});
