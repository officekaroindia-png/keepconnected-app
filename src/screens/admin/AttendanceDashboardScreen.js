import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffDashboard } from '../../api/admin';

const MARK = {
  ontime:      { icon: 'ellipse', c: '#22C55E' },
  little_late: { icon: 'ellipse', c: '#F59E0B' },
  late:        { icon: 'ellipse', c: '#EF4444' },
  wfh:         { icon: 'home',    c: COLORS.primary },
  absent:      { icon: 'close-circle', c: '#EF4444' },
  off:         { icon: 'happy-outline', c: '#2563EB' },
  holiday:     { icon: 'ellipse', c: '#38BDF8' },
  pending:     { icon: 'ellipse', c: '#CBD5E1' },
};
const LEGEND = [
  ['Present on time', 'ontime'], ['Little Late', 'little_late'], ['Late', 'late'],
  ['Absent', 'absent'], ['Off day', 'off'], ['National holiday', 'holiday'], ['Pending', 'pending'],
];
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AttendanceDashboardScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { id, name } = route.params;
  const [data, setData] = useState(null);
  const load = useCallback(async () => { try { setData(await staffDashboard(id)); } catch {} }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
        <Text style={styles.barTitle}>Dashboard</Text><View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
        {!data && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {data && <>
          <Text style={styles.chartTitle}>Attendance Chart · {name}</Text>
          <Text style={styles.monthLbl}>{MONTHS[data.month]} {data.year}</Text>

          <View style={[styles.table, SHADOW.card]}>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 1.4 }]}>Date</Text>
              <Text style={[styles.th, { flex: 1 }]}>Day</Text>
              <Text style={[styles.th, { width: 44, textAlign: 'center' }]}>Adm</Text>
              <Text style={[styles.th, { width: 56, textAlign: 'center' }]}>Status</Text>
            </View>
            {data.rows.map((r) => {
              const m = MARK[r.status] || MARK.pending;
              return (
                <View key={r.date} style={styles.tr}>
                  <Text style={[styles.td, { flex: 1.4 }]}>{r.date.slice(5)}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{r.day}</Text>
                  <View style={{ width: 44, alignItems: 'center' }}>{r.adminActed ? <Ionicons name="build" size={18} color={COLORS.textSoft} /> : <Text style={styles.dash}>–</Text>}</View>
                  <View style={{ width: 56, alignItems: 'center' }}><Ionicons name={m.icon} size={30} color={m.c} /></View>
                </View>
              );
            })}
          </View>

          <Text style={styles.calcTitle}>Attendance calculation · {name}</Text>
          <View style={[styles.calc, SHADOW.card]}>
            {LEGEND.map(([label, key]) => {
              const m = MARK[key];
              return (
                <View key={key} style={styles.calcRow}>
                  <Ionicons name={m.icon} size={26} color={m.c} />
                  <Text style={styles.calcLabel}>{label}</Text>
                  <Text style={styles.calcNum}>{data.summary[key] ?? 0}</Text>
                </View>
              );
            })}
          </View>
        </>}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: SP.md, backgroundColor: '#0E9F6E' },
  barTitle: { ...TYPE.h2, color: COLORS.white },
  chartTitle: { ...TYPE.title, color: COLORS.text, textDecorationLine: 'underline' },
  monthLbl: { ...TYPE.label, color: COLORS.textMute, marginTop: 2, marginBottom: SP.md },
  table: { backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  thead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: COLORS.surfaceAlt },
  th: { ...TYPE.cap, color: COLORS.textSoft, fontWeight: '800' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  td: { ...TYPE.body, color: COLORS.text, fontSize: 13 },
  dash: { color: COLORS.textMute },
  calcTitle: { ...TYPE.title, color: COLORS.text, marginTop: SP.xl, marginBottom: SP.sm, textDecorationLine: 'underline' },
  calc: { backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, padding: SP.md },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  calcLabel: { flex: 1, ...TYPE.body, color: COLORS.textSoft },
  calcNum: { ...TYPE.title, color: COLORS.text },
});
