// Apple-Maps-style route header: back chevron + "origin → destination",
// with a functional "Evitar" (avoid) dropdown that toggles ORS avoid
// features (portagens / autoestradas / ferries) and recomputes the route.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme/theme';

const AVOID_OPTIONS = [
  { key: 'tollways', label: 'Portagens' },
  { key: 'highways', label: 'Autoestradas' },
  { key: 'ferries', label: 'Ferries' },
];

export default function RouteTopBar({
  originLabel = 'Localização atual',
  destName,
  onBack,
  avoid = [],
  onToggleAvoid,
  onInteract,
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <View style={s.bar}>
        <TouchableOpacity style={s.back} onPress={onBack} hitSlop={12}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <View style={s.route}>
          <Text style={s.origin} numberOfLines={1}>{originLabel}</Text>
          <Text style={s.arrow}>→</Text>
          <Text style={s.dest} numberOfLines={1}>{destName || 'Destino'}</Text>
        </View>
      </View>

      <View style={s.evitarRow}>
        <TouchableOpacity
          style={[s.evitarBtn, avoid.length > 0 && s.evitarBtnOn]}
          onPress={() => {
            onInteract?.();
            setOpen((o) => !o);
          }}
          activeOpacity={0.85}
        >
          <Text style={[s.evitarTxt, avoid.length > 0 && s.evitarTxtOn]}>Evitar</Text>
          {avoid.length > 0 ? <Text style={s.evitarCount}>{avoid.length}</Text> : null}
          <Text style={[s.caret, avoid.length > 0 && s.evitarTxtOn]}>⌄</Text>
        </TouchableOpacity>
      </View>

      {open ? (
        <View style={s.menu}>
          {AVOID_OPTIONS.map((o, i) => {
            const on = avoid.includes(o.key);
            return (
              <Pressable
                key={o.key}
                style={[s.menuRow, i > 0 && s.menuRowBorder]}
                onPress={() => onToggleAvoid(o.key)}
              >
                <Text style={s.menuLabel}>{o.label}</Text>
                <View style={[s.check, on && s.checkOn]}>
                  {on ? <Text style={s.checkTxt}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 10,
    ...shadow.lg,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 30, color: colors.c2, fontWeight: '600', marginTop: -4 },
  route: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  origin: { fontSize: 15, color: colors.text2, fontWeight: '600', flexShrink: 1 },
  arrow: { fontSize: 15, color: colors.text3 },
  dest: { fontSize: 15, color: colors.navy, fontWeight: '700', flexShrink: 1 },

  evitarRow: { flexDirection: 'row', marginTop: 10 },
  evitarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadow.card,
  },
  evitarBtnOn: { backgroundColor: colors.c2 },
  evitarTxt: { fontSize: 14, fontWeight: '700', color: colors.c2 },
  evitarTxtOn: { color: '#fff' },
  caret: { fontSize: 13, color: colors.c2, marginTop: -3 },
  evitarCount: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.c2,
    backgroundColor: '#fff',
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    textAlign: 'center',
    overflow: 'hidden',
    lineHeight: 17,
  },

  menu: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minWidth: 200,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 4,
    ...shadow.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: colors.bg },
  menuLabel: { fontSize: 14, color: colors.navy, fontWeight: '500' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.c2, borderColor: colors.c2 },
  checkTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
