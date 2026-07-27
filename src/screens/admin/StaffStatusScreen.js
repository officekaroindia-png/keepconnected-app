import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffStatus } from '../../api/admin';

// Right-side status square — reflects the live day progression:
// checked in -> green · at office -> office icon · checked out -> red · nothing/after hours -> none
const squareForExport = (s) => {
  if (s.checkOut)  return { icon: 'log-out',   c: COLORS.danger,  bg: COLORS.dangerTint };
  if (s.atOffice)  return { icon: 'business',  c: '#0E7490',      bg: '#E0F2F1' };
  if (s.checkIn)   return { icon: 'log-in',    c: COLORS.success, bg: COLORS.successTint };
  if (s.status === 'off')     return { icon: 'happy', c: '#2563EB', bg: COLORS.primaryTint };
  if (s.status === 'holiday') return { icon: 'sunny', c: COLORS.gold, bg: COLORS.goldTint };
  if (s.status === 'absent')  return { icon: 'close', c: COLORS.danger, bg: COLORS.dangerTint };
  return { icon: 'remove', c: COLORS.textMute, bg: COLORS.surfaceAlt }; // none
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Swipe a card LEFT to reveal a Dashboard button (monthly attendance chart).
// Tap the status icon to open that person's timeline for today.
function StaffCard({ s, taskCount, navigation }) {
  const sq = squareForExport(s);
  const tx = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const REVEAL = 96;

  const snap = (to) => { openRef.current = to !== 0; Animated.spring(tx, { toValue: to, useNativeDriver: true, bounciness: 4 }).start(); };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_e, g) => {
      let x = (openRef.current ? -REVEAL : 0) + g.dx;
      x = Math.max(-REVEAL, Math.min(0, x));
      tx.setValue(x);
    },
    onPanResponderRelease: (_e, g) => {
      const x = (openRef.current ? -REVEAL : 0) + g.dx;
      snap(x < -REVEAL / 2 ? -REVEAL : 0);
    },
  })).current;

  const openToday = () => navigation.navigate('StaffTimeline', { id: s.id, name: s.name, date: todayLocal() });
  const openDashboard = () => { snap(0); navigation.navigate('AttendanceDashboard', { id: s.id, name: s.name }); };

  return (
    <View style={styles.swipeWrap}>
      <Pressable onPress={openDashboard} style={styles.revealBtn}>
        <Ionicons name="stats-chart" size={20} color={COLORS.white} />
        <Text style={styles.revealTxt}>Dashboard</Text>
      </Pressable>
      <Animated.View style={[styles.card, SHADOW.card, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <Pressable style={styles.cardMain} onPress={() => navigation.navigate('Contact', { name: s.name, mobile: s.mobile, designation: s.designation, staffId: s.id })}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{s.name[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{s.name}</Text>
              {s.role === 'admin' && <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />}
            </View>
            <TaskChecks done={s.tasksDone} total={taskCount} />
          </View>
        </Pressable>
        <Pressable onPress={openToday} style={[styles.square, { backgroundColor: sq.bg }]}>
          <Ionicons name={sq.icon} size={20} color={sq.c} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const TaskChecks = ({ done, total }) => (
  <View style={styles.checks}>
    {Array.from({ length: total }).map((_, i) => (
      <Ionicons key={i} name={i < done ? 'checkmark-circle' : 'ellipse-outline'} size={18}
        color={i < done ? COLORS.success : COLORS.border} style={{ marginRight: 4 }} />
    ))}
  </View>
);

export default function StaffStatusScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState({ staff: [], taskCount: 3 });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { setData(await staffStatus()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.barTitle}>Staff Status</Text>
        <Pressable onPress={load} hitSlop={10}><Ionicons name="refresh" size={22} color={COLORS.primary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {data.staff.map((s) => {
          
          return <StaffCard key={s.id} s={s} taskCount={data.taskCount} navigation={navigation} />;
        })}
        <Text style={styles.hint}>Tap the status icon for today's timeline · swipe a card left for the monthly dashboard · tap the card to call/message.</Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: SP.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  barTitle: { ...TYPE.h2, color: COLORS.text },
  swipeWrap: { position: 'relative', justifyContent: 'center', marginBottom: SP.sm },
  revealBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 96, backgroundColor: COLORS.primary, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', gap: 4 },
  revealTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SP.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.textSoft },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { ...TYPE.title, color: COLORS.text },
  checks: { flexDirection: 'row', alignItems: 'center' },
  square: { width: 48, height: 48, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginLeft: SP.md },
  hint: { ...TYPE.cap, color: COLORS.textMute, textAlign: 'center', marginTop: SP.md, lineHeight: 17 },
});
