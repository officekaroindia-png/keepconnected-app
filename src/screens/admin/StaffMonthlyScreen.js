import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffDashboard } from '../../api/admin';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hhmm = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
const todayStr = () => new Intl.DateTimeFormat('en-CA').format(new Date());

export default function StaffMonthlyScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { id, name } = route.params;
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await staffDashboard(id, ym.y, ym.m)); } catch {} finally { setLoading(false); }
  }, [id, ym]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shift = (d) => setYm(({ y, m }) => { let nm = m + d, ny = y; if (nm < 1) { nm = 12; ny--; } if (nm > 12) { nm = 1; ny++; } return { y: ny, m: nm }; });
  const today = todayStr();

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.title}>Timelines · {name}</Text><View style={{ width: 24 }} />
        </View>
        <View style={styles.monthRow}>
          <Pressable onPress={() => shift(-1)} style={styles.navBtn}><Text style={styles.navTxt}>‹ Prev</Text></Pressable>
          <Text style={styles.month}>{MONTHS[ym.m]} {ym.y}</Text>
          <Pressable onPress={() => shift(1)} style={styles.navBtn}><Text style={styles.navTxt}>Next ›</Text></Pressable>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: COLORS.success }]} /><Text style={styles.legendTxt}>Check-in</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: COLORS.danger }]} /><Text style={styles.legendTxt}>Check-out</Text></View>
        </View>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}
        {data?.rows?.filter((r) => r.date <= today).reverse().map((r) => {
          const ci = hhmm(r.checkIn), co = hhmm(r.checkOut);
          return (
            <Pressable key={r.date} onPress={() => navigation.navigate('StaffTimeline', { id, name, date: r.date })}
              style={({ pressed }) => [styles.dayRow, SHADOW.card, pressed && { opacity: 0.9 }]}>
              <View style={styles.dateCol}>
                <Text style={styles.dateNum}>{r.date.slice(8)}</Text>
                <Text style={styles.dayName}>{r.day}</Text>
              </View>
              <View style={styles.times}>
                <View style={styles.timeItem}><Ionicons name="log-in" size={15} color={COLORS.success} /><Text style={[styles.timeTxt, { color: COLORS.success }]}>{ci || '—'}</Text></View>
                <View style={styles.timeItem}><Ionicons name="log-out" size={15} color={COLORS.danger} /><Text style={[styles.timeTxt, { color: COLORS.danger }]}>{co || '—'}</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMute} />
            </Pressable>
          );
        })}
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
  navBtn: { backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm },
  navTxt: { ...TYPE.label, color: COLORS.white },
  month: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  legend: { flexDirection: 'row', gap: SP.lg, justifyContent: 'center', marginBottom: SP.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { ...TYPE.cap, color: COLORS.textSoft },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  dateCol: { width: 44, alignItems: 'center' },
  dateNum: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  dayName: { ...TYPE.cap, color: COLORS.textMute },
  times: { flex: 1, gap: 4 },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeTxt: { ...TYPE.title, fontVariant: ['tabular-nums'] },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 30 },
});
