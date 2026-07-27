import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { getTimeline } from '../api/day';
import { staffAction } from '../api/admin';

// Icon + color per event type (matches the old app's timeline)
const EV = {
  checkin:    { icon: 'airplane', c: COLORS.success, label: 'Checked In', rot: '90deg' },
  atoffice:   { icon: 'business', c: '#0E7490', label: 'At Office' },
  checkout:   { icon: 'airplane', c: COLORS.danger, label: 'Checked Out', rot: '-90deg' },
  reached:    { icon: 'arrow-forward', c: COLORS.success, label: 'Reached' },
  leaving:    { icon: 'arrow-back', c: COLORS.success, label: 'Leaving' },
  wfh:        { icon: 'home', c: COLORS.primary, label: 'Work From Home' },
  remove_wfh: { icon: 'home-outline', c: COLORS.textSoft, label: 'Removed WFH' },
  lunch:      { icon: 'restaurant', c: COLORS.warn, label: 'Lunch' },
  absent:     { icon: 'close-circle', c: COLORS.danger, label: 'Absent' },
};
const SELF_DIAL = [
  { kind: 'checkin',        label: 'Check in',        icon: 'log-in',      c: COLORS.success },
  { kind: 'reset_checkin',  label: 'Reset check-in',  icon: 'refresh',     c: COLORS.success },
  { kind: 'checkout',       label: 'Check out',       icon: 'log-out',     c: COLORS.danger },
  { kind: 'reset_checkout', label: 'Reset check-out', icon: 'refresh',     c: COLORS.warn },
  { kind: 'mark_absent',    label: 'Mark absent',     icon: 'close-circle',c: COLORS.danger },
];
const hhmm = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtTotal = (m) => m ? `${Math.floor(m / 60)}h ${m % 60}m` : '—';
const fmtDist = (m) => (m == null ? null : m >= 1000 ? `${(m / 1000).toFixed(1)} kms` : `${Math.round(m)} mts`);


export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dial, setDial] = useState(false);
  const isAdmin = user?.role === 'admin';
  const load = useCallback(async () => { try { setData(await getTimeline()); } catch {} finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runSelf = (kind, label) => {
    setDial(false);
    Alert.alert(label, `${label} for yourself?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => { try { await staffAction(user.id, kind); load(); } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); } } },
    ]);
  };

  const events = data?.events || [];
  const today = new Date().toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <Text style={styles.title}>Timeline</Text>
        <Text style={styles.sub}>{data?.name || user?.name} · {today}</Text>
        <View style={styles.pillRow}>
          <View style={styles.totalPill}><Ionicons name="time-outline" size={15} color={COLORS.ink} /><Text style={styles.totalTxt}>{fmtTotal(data?.totalMinutes)}</Text></View>
          <View style={styles.totalPill}><Ionicons name="navigate-outline" size={15} color={COLORS.ink} /><Text style={styles.totalTxt}>{fmtDist(data?.totalMeters) || '0 mts'}</Text></View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {!loading && events.length === 0 && <Text style={styles.dim}>No activity yet today. Use the Actions button to check in.</Text>}
        {events.map((e, i) => {
          const ev = EV[e.type] || EV.checkin;
          return (
            <Animated.View key={i} entering={FadeInDown.delay(40 * i)} style={styles.row}>
              <View style={styles.timeCol}><Text style={styles.time}>{hhmm(e.at)}</Text></View>
              <View style={styles.lineCol}>
                <View style={[styles.node, { backgroundColor: ev.c }]}>
                  <Ionicons name={ev.icon} size={14} color={COLORS.white} style={ev.rot ? { transform: [{ rotate: ev.rot }] } : null} />
                </View>
                {i < events.length - 1 && <View style={styles.stem} />}
              </View>
              <View style={styles.body}>
                <Text style={styles.evLabel}>{ev.label}{e.byAdmin ? '  (by admin)' : ''}</Text>
                {e.address ? <Text style={styles.addr}>{e.address}</Text> : (e.lat != null && e.lng != null) && <Text style={styles.addr}>{e.lat.toFixed(5)}, {e.lng.toFixed(5)}</Text>}
                {e.distance != null && e.distance > 0 && <Text style={styles.dist}>Distance: {fmtDist(e.distance)}</Text>}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {isAdmin && dial && <Pressable style={styles.dialScrim} onPress={() => setDial(false)} />}
      {isAdmin && dial && SELF_DIAL.map((d, i) => (
        <Pressable key={d.kind} onPress={() => runSelf(d.kind, d.label)} style={[styles.dialItem, { bottom: insets.bottom + 90 + (SELF_DIAL.length - 1 - i) * 58 }, SHADOW.lift]}>
          <Text style={styles.dialLabel}>{d.label}</Text>
          <View style={[styles.dialIcon, { backgroundColor: d.c }]}><Ionicons name={d.icon} size={18} color={COLORS.white} /></View>
        </Pressable>
      ))}
      {isAdmin && (
        <Pressable onPress={() => setDial((v) => !v)} style={[styles.fab, { bottom: insets.bottom + 24 }, SHADOW.lift]}>
          <Ionicons name={dial ? 'close' : 'construct'} size={24} color={COLORS.white} />
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  title: { ...TYPE.h1, color: COLORS.white },
  sub: { ...TYPE.label, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md },
  totalPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  totalTxt: { ...TYPE.cap, color: COLORS.ink, fontWeight: '800' },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40, paddingHorizontal: SP.lg },
  row: { flexDirection: 'row', gap: SP.sm },
  timeCol: { width: 52, paddingTop: 2 },
  time: { ...TYPE.label, color: COLORS.text, fontWeight: '800' },
  lineCol: { alignItems: 'center', width: 30 },
  dialScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(241,245,249,0.82)' },
  dialItem: { position: 'absolute', right: SP.lg, flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  dialLabel: { ...TYPE.cap, color: COLORS.text, fontWeight: '800', backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.sm, overflow: 'hidden' },
  dialIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: SP.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  node: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stem: { flex: 1, width: 3, backgroundColor: COLORS.border, marginVertical: 2, minHeight: 20 },
  body: { flex: 1, paddingBottom: SP.lg },
  evLabel: { ...TYPE.title, color: COLORS.text },
  addr: { ...TYPE.body, color: COLORS.textSoft, marginTop: 2, lineHeight: 19 },
  dist: { ...TYPE.cap, color: COLORS.primary, marginTop: 2 },
});
