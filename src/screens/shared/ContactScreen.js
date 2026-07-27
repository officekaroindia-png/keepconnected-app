import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { callNumber, whatsappNumber } from '../../hooks/useContact';
import { pendingTasks, approveTasks, declineTasks } from '../../api/admin';

const hhmmss = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export default function ContactScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { name, mobile, designation, staffId } = route.params;
  const today = new Date().toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!staffId);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!staffId) return;
    try { setData(await pendingTasks(staffId)); } catch {} finally { setLoading(false); }
  }, [staffId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = async (date) => { setBusy(date); try { const r = await approveTasks(staffId, date); Alert.alert('Approved', r.added ? `${r.added} points added to the leaderboard.` : 'Done.'); load(); } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); } finally { setBusy(null); } };
  const decline = async (date) => { setBusy(date); try { await declineTasks(staffId, date); load(); } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); } finally { setBusy(null); } };

  const groups = data?.groups || [];
  const older = groups.filter((g) => !g.isToday && g.pending);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.white} /></Pressable>
          <Text style={styles.date}>{today}</Text>
          {staffId ? <Pressable onPress={() => navigation.navigate('StaffTimeline', { id: staffId, name })} hitSlop={10}><Ionicons name="walk" size={22} color={COLORS.white} /></Pressable> : <View style={{ width: 24 }} />}
        </View>
        <Text style={styles.name}>{name}</Text>
        {!!designation && <Text style={styles.desig}>{designation}</Text>}
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.number}>{mobile}</Text>
          <View style={styles.btnRow}>
            <Pressable onPress={() => callNumber(mobile)} style={[styles.btn, SHADOW.card]}><Ionicons name="call" size={22} color={COLORS.white} /></Pressable>
            <Pressable onPress={() => whatsappNumber(mobile)} style={[styles.btn, SHADOW.card]}><Ionicons name="logo-whatsapp" size={22} color={COLORS.white} /></Pressable>
          </View>
        </View>

        {staffId && (
          <Pressable onPress={() => navigation.navigate('StaffMonthly', { id: staffId, name })} style={[styles.timelinesBtn, SHADOW.card]}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.timelinesTxt}>View old timelines (by month)</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMute} />
          </Pressable>
        )}

        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {staffId && !loading && groups.length === 0 && <Text style={styles.empty}>No data for the user right now</Text>}

        {older.length > 0 && (
          <View style={styles.olderBanner}>
            <Ionicons name="alert-circle" size={16} color={COLORS.warn} />
            <Text style={styles.olderTxt}>{older.length} earlier day{older.length > 1 ? 's' : ''} still need approval</Text>
          </View>
        )}

        {groups.map((g) => (
          <View key={g.date} style={styles.group}>
            <Text style={styles.groupDate}>{g.isToday ? 'Today' : g.date}{g.pending ? '' : '  · approved'}</Text>
            {g.taps.map((t) => (
              <View key={t.id} style={styles.tapRow}>
                <View style={[styles.tapIcon, t.approved && { backgroundColor: COLORS.successTint }]}><Ionicons name={t.icon} size={20} color={t.approved ? COLORS.success : COLORS.textSoft} /></View>
                <Text style={styles.tapName}>{t.name}</Text>
                <Text style={styles.tapTime}>{hhmmss(t.at)}</Text>
              </View>
            ))}
            {g.pending
              ? <View style={styles.approveRow}>
                  <Pressable onPress={() => approve(g.date)} disabled={busy === g.date} style={[styles.approveBtn, { backgroundColor: COLORS.success }]}>{busy === g.date ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.approveTxt}>Approve</Text>}</Pressable>
                  <Pressable onPress={() => decline(g.date)} disabled={busy === g.date} style={[styles.approveBtn, { backgroundColor: COLORS.inkSoft }]}><Text style={styles.approveTxt}>Decline</Text></Pressable>
                </View>
              : <Text style={styles.approvedNote}>Approved — points counted.</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.xl, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { ...TYPE.title, color: COLORS.white },
  name: { fontSize: 26, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginTop: SP.lg, letterSpacing: 1 },
  desig: { ...TYPE.label, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 },
  card: { backgroundColor: COLORS.surface, margin: SP.lg, borderRadius: R.lg, padding: SP.xl, alignItems: 'center', ...SHADOW.card, borderWidth: 1, borderColor: COLORS.border },
  number: { fontSize: 22, fontWeight: '800', color: '#0E7490', letterSpacing: 2, marginBottom: SP.lg },
  btnRow: { flexDirection: 'row', gap: SP.lg },
  btn: { width: 120, height: 52, borderRadius: R.md, backgroundColor: '#0E9F6E', alignItems: 'center', justifyContent: 'center' },
  timelinesBtn: { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginHorizontal: SP.lg, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border },
  timelinesTxt: { flex: 1, ...TYPE.title, color: COLORS.text },
  empty: { ...TYPE.title, color: COLORS.textSoft, textAlign: 'center', marginTop: SP.xl },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SP.lg, marginVertical: SP.lg },
  olderBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SP.lg, marginBottom: SP.sm, backgroundColor: COLORS.goldTint, borderRadius: R.sm, padding: SP.md },
  olderTxt: { ...TYPE.cap, color: '#92600A', fontWeight: '700' },
  group: { marginHorizontal: SP.lg, marginBottom: SP.md, backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SP.sm },
  groupDate: { ...TYPE.label, color: COLORS.textSoft, paddingHorizontal: SP.md, paddingVertical: SP.sm },
  tapRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: SP.sm },
  tapIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  tapName: { flex: 1, ...TYPE.body, color: COLORS.text, fontWeight: '600' },
  tapTime: { ...TYPE.title, color: COLORS.text, fontVariant: ['tabular-nums'] },
  approveRow: { flexDirection: 'row', gap: SP.md, paddingHorizontal: SP.lg },
  approveBtn: { flex: 1, height: 52, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  approveTxt: { ...TYPE.title, fontSize: 16, color: COLORS.white },
  approvedNote: { ...TYPE.body, color: COLORS.success, textAlign: 'center', fontWeight: '700' },
});
