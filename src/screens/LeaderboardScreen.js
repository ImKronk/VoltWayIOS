// Leaderboard — ports #screen-leaderboard (top users, my stats, level card).
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { colors, radius, shadow } from '../theme/theme';
import { LEADERBOARD, MY_STATS, LEVEL } from '../data/demo';

const TIER_BORDER = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' };

function Row({ k, v, accent }) {
  return (
    <View style={[s.row, accent && s.rowAccent]}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, accent && { color: colors.c2, fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}

export default function LeaderboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('top');

  return (
    <View style={s.container}>
      <ScreenHeader title="Leaderboard" navigation={navigation} right={<Text style={{ fontSize: 18 }}>🏆</Text>} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tab, tab === 'top' && s.tabActive]} onPress={() => setTab('top')}>
            <Text style={[s.tabTxt, tab === 'top' && s.tabTxtActive]}>Top Utilizadores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 'my' && s.tabActive]} onPress={() => setTab('my')}>
            <Text style={[s.tabTxt, tab === 'my' && s.tabTxtActive]}>As Minhas Stats</Text>
          </TouchableOpacity>
        </View>

        {tab === 'top' ? (
          LEADERBOARD.map((u) => (
            <View
              key={u.rank}
              style={[s.leaderItem, u.tier && { borderLeftWidth: 4, borderLeftColor: TIER_BORDER[u.tier] }]}
            >
              <Text style={s.rank}>{u.rank}</Text>
              <View style={[s.avatar, { backgroundColor: u.color }]}>
                <Text style={[s.avatarTxt, u.darkText && { color: colors.c1 }]}>{u.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{u.name}</Text>
                <Text style={s.badge}>{u.badge}</Text>
              </View>
              <Text style={s.pts}>{u.pts} pts</Text>
              <Text style={s.emoji}>{u.emoji}</Text>
            </View>
          ))
        ) : (
          <View>
            <View style={s.statGrid}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{MY_STATS.rank}</Text>
                <Text style={s.statLabel}>O Teu Lugar</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statNum}>{MY_STATS.points}</Text>
                <Text style={s.statLabel}>Pontos Totais</Text>
              </View>
            </View>
            <View style={s.card}>
              <Row k="Atualizações Submetidas" v={String(MY_STATS.updatesSubmitted)} />
              <Row k="Confirmadas Corretas" v={String(MY_STATS.confirmedAccurate)} />
              <Row k="Pontos Bónus" v={`+${MY_STATS.bonusPoints}`} accent />
            </View>
          </View>
        )}

        <View style={s.levelCard}>
          <View style={s.levelIcon}>
            <Text style={{ fontSize: 22 }}>⭐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.levelTitle}>{LEVEL.title}</Text>
            <Text style={s.levelSub}>Tu: {LEVEL.points} Pontos</Text>
            <View style={s.levelBar}>
              <View style={[s.levelFill, { width: `${LEVEL.progressPct}%` }]} />
            </View>
            <Text style={s.levelNext}>
              Próximo nível: {LEVEL.nextPts} pts — {LEVEL.nextLabel}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={s.cta}
          onPress={() => Alert.alert('Recompensas', 'Recompensas resgatadas! 🎉')}
        >
          <Text style={s.ctaTxt}>Resgatar Recompensas  →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  tabRow: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 10, padding: 3, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.card, ...shadow.card },
  tabTxt: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  tabTxtActive: { color: colors.navy },

  leaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 6,
    ...shadow.card,
  },
  rank: { fontSize: 16, fontWeight: '800', color: colors.text3, width: 22, textAlign: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '600', color: colors.navy },
  badge: { fontSize: 11, color: colors.text3 },
  pts: { fontSize: 14, fontWeight: '700', color: colors.c2 },
  emoji: { fontSize: 18 },

  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, alignItems: 'center', ...shadow.card },
  statNum: { fontSize: 26, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 12, color: colors.text3, marginTop: 4 },

  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.bg },
  rowAccent: { backgroundColor: 'rgba(57,91,100,0.06)', marginHorizontal: -16, paddingHorizontal: 16, borderBottomWidth: 0 },
  rowK: { fontSize: 13, color: colors.text2 },
  rowV: { fontSize: 13, color: colors.navy, fontWeight: '500' },

  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 16,
    ...shadow.card,
  },
  levelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(57,91,100,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  levelSub: { fontSize: 12, color: colors.text2, marginBottom: 6 },
  levelBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  levelFill: { height: '100%', backgroundColor: colors.c2, borderRadius: 3 },
  levelNext: { fontSize: 11, color: colors.text3 },

  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: { backgroundColor: colors.c2, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
