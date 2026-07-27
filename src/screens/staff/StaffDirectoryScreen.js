import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { getDirectory } from '../../api/staff';
import { callNumber, whatsappNumber } from '../../hooks/useContact';

// The live status mark — same language as the admin Staff Status:
// checked in -> green · at office -> office icon · checked out -> red · nothing -> none.
const markFor = (s) => {
  if (s.checkOut)  return { icon: 'log-out',  label: 'Checked out', c: COLORS.danger,  bg: COLORS.dangerTint };
  if (s.atOffice)  return { icon: 'business', label: 'At office',   c: '#0E7490',      bg: '#E0F2F1' };
  if (s.checkIn)   return { icon: 'log-in',   label: 'Checked in',  c: COLORS.success, bg: COLORS.successTint };
  if (s.status === 'off')     return { icon: 'cafe',  label: 'Week off', c: '#2563EB',      bg: COLORS.primaryTint };
  if (s.status === 'holiday') return { icon: 'sunny', label: 'Holiday',  c: COLORS.gold,    bg: COLORS.goldTint };
  return { icon: 'ellipse-outline', label: 'Not in', c: COLORS.textMute, bg: COLORS.surfaceAlt };
};
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null);

export default function StaffDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { setRows(await getDirectory()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const inCount = useMemo(() => rows.filter((p) => p.checkIn && !p.checkOut).length, [rows]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <Text style={styles.title}>Team</Text>
        <Text style={styles.sub}>See who's in right now</Text>
        <View style={styles.statRow}>
          <View style={styles.statPill}><View style={[styles.dot, { backgroundColor: COLORS.success }]} /><Text style={styles.statTxt}>{inCount} in now</Text></View>
          <View style={styles.statPill}><Ionicons name="people" size={13} color={COLORS.ink} /><Text style={styles.statTxt}>{rows.length} total</Text></View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}

        {rows.map((p, i) => {
          const m = markFor(p);
          const timeText = p.checkOut ? `Out ${hhmm(p.checkOut)}` : p.checkIn ? `In ${hhmm(p.checkIn)}` : null;
          return (
            <Animated.View key={p.id} entering={FadeInDown.delay(25 * i).springify().damping(18)} style={[styles.card, SHADOW.card]}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}><Text style={styles.avatarTxt}>{p.name[0]?.toUpperCase()}</Text></View>
                <View style={[styles.markDot, { backgroundColor: m.c, borderColor: COLORS.surface }]} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  {p.role === 'admin' && <Ionicons name="shield-checkmark" size={13} color={COLORS.success} />}
                </View>
                <View style={styles.statusLine}>
                  <View style={[styles.markChip, { backgroundColor: m.bg }]}>
                    <Ionicons name={m.icon} size={12} color={m.c} />
                    <Text style={[styles.markTxt, { color: m.c }]}>{m.label}</Text>
                  </View>
                  {timeText && <Text style={styles.time}>{timeText}</Text>}
                </View>
              </View>

              <Pressable onPress={() => callNumber(p.mobile)} hitSlop={6} style={[styles.iconBtn, { backgroundColor: COLORS.primaryTint }]}><Ionicons name="call" size={17} color={COLORS.primary} /></Pressable>
              <Pressable onPress={() => whatsappNumber(p.mobile)} hitSlop={6} style={[styles.iconBtn, { backgroundColor: '#DCFCE7' }]}><Ionicons name="logo-whatsapp" size={17} color="#0E9F6E" /></Pressable>
            </Animated.View>
          );
        })}
        {!loading && !rows.length && <Text style={styles.dim}>No teammates yet.</Text>}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.xl, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  title: { ...TYPE.h1, color: COLORS.white },
  sub: { ...TYPE.label, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, paddingHorizontal: 11, paddingVertical: 6, borderRadius: R.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statTxt: { ...TYPE.cap, color: COLORS.ink, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  avatarWrap: { width: 46, height: 46 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.primary, fontSize: 17 },
  markDot: { position: 'absolute', right: -1, bottom: -1, width: 15, height: 15, borderRadius: 8, borderWidth: 2.5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { ...TYPE.title, color: COLORS.text, flexShrink: 1 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  markChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  markTxt: { fontSize: 11, fontWeight: '800' },
  time: { ...TYPE.cap, color: COLORS.textMute },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
});
