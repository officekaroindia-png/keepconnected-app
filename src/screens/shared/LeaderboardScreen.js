import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getLeaderboard } from '../../api/extra';
import { useAuth } from '../../context/AuthContext';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function LeaderboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getLeaderboard(ym.y, ym.m)); } catch {} finally { setLoading(false); }
  }, [ym]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shift = (d) => setYm(({ y, m }) => { let nm = m + d, ny = y; if (nm < 1) { nm = 12; ny--; } if (nm > 12) { nm = 1; ny++; } return { y: ny, m: nm }; });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          {navigation.canGoBack() ? <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable> : <View style={{ width: 24 }} />}
          <Text style={styles.title}>Leaderboard</Text><View style={{ width: 24 }} />
        </View>
        <View style={styles.monthRow}>
          <Pressable onPress={() => shift(-1)} style={styles.navBtn}><Text style={styles.navTxt}>‹ Prev</Text></Pressable>
          <View style={{ alignItems: 'center' }}><Text style={styles.month}>{MONTHS[ym.m]}</Text><Text style={styles.byTxt}>Points</Text></View>
          <Pressable onPress={() => shift(1)} style={styles.navBtn}><Text style={styles.navTxt}>Next ›</Text></Pressable>
        </View>
        <View style={styles.totalPill}><Text style={styles.totalTxt}>Total Points: {data?.totalPoints ?? 0}</Text></View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
        <View style={[styles.rowHead, SHADOW.card]}>
          <Text style={[styles.hName, { flex: 1 }]}>Name</Text>
          <Text style={styles.hCol}>hrs</Text><Text style={styles.hCol}>pts</Text>
        </View>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}
        {data?.rows?.map((r) => (
          <View key={r.id} style={[styles.row, SHADOW.card, r.id === user?.id && styles.rowMe]}>
            <Text style={[styles.name, { flex: 1 }, r.id === user?.id && { color: COLORS.primary }]}>{r.name}</Text>
            <Text style={styles.col}>{r.hours}</Text>
            <Text style={[styles.col, styles.pts]}>{r.points}</Text>
          </View>
        ))}
        {!loading && !data?.rows?.length && <Text style={styles.dim}>No data for this month.</Text>}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.md },
  navBtn: { backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.sm },
  navTxt: { ...TYPE.label, color: COLORS.white },
  month: { fontSize: 22, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  byTxt: { ...TYPE.cap, color: 'rgba(255,255,255,0.7)' },
  totalPill: { alignSelf: 'center', backgroundColor: COLORS.white, paddingHorizontal: 18, paddingVertical: 8, borderRadius: R.pill, marginTop: SP.md },
  totalTxt: { ...TYPE.title, color: COLORS.ink },
  rowHead: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  hName: { ...TYPE.title, color: COLORS.text }, hCol: { ...TYPE.title, color: COLORS.textSoft, width: 48, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  rowMe: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  name: { ...TYPE.title, color: COLORS.text }, col: { ...TYPE.title, color: COLORS.text, width: 48, textAlign: 'right' },
  pts: { color: COLORS.gold, fontWeight: '800' },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 30 },
});
