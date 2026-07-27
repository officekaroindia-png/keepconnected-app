import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getToday, tapTask } from '../api/day';
import { useClock } from '../hooks/useClock';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

const STATUS = {
  ontime:      { t: 'Present', c: COLORS.success },
  little_late: { t: 'Little late', c: COLORS.warn },
  late:        { t: 'Late', c: COLORS.danger },
  wfh:         { t: 'WFH', c: COLORS.primary },
  absent:      { t: 'Absent', c: COLORS.textMute },
  pending:     { t: 'Not in', c: COLORS.textMute },
  off:         { t: 'Off day', c: COLORS.textMute },
  holiday:     { t: 'Holiday', c: COLORS.gold },
};
const time = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export default function ActionsHomeScreen({ navigation, day, loading, reload }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const now = useClock();
  const [tapping, setTapping] = React.useState(null);
  useFocusEffect(useCallback(() => { reload?.(); }, [reload]));
  if (loading && !day) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  const st = STATUS[day?.status] || STATUS.pending;
  const prog = day?.taskProgress || { done: 0, total: 0 };

  // Live minute-of-day from the ticking clock, so cards open/close to the exact minute.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const allTasks = day?.tasks || [];
  const maxEnd = allTasks.reduce((mx, t) => Math.max(mx, t.window?.end ?? 0), 0);
  // Show the whole task block from midnight until the last task's deadline.
  const showTasks = allTasks.length > 0 && nowMin <= maxEnd;
  const fmtMin = (m) => { const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'AM' : 'PM', hh = h % 12 || 12; return `${hh}:${String(mm).padStart(2, '0')} ${ap}`; };
  const taskState = (t) => {
    if (t.done) return 'done';
    if (nowMin < t.window.start) return 'soon';
    if (nowMin > t.window.end) return 'late';
    return 'open';
  };
  const onTapTask = async (t) => {
    const st = taskState(t);
    if (st === 'soon') return showToast(`Opens at ${fmtMin(t.window.start)}`, 'error');
    if (st === 'late') return showToast("You're too late for this one", 'error');
    if (st === 'done') return;
    setTapping(t.id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await tapTask(t.id);
      if (res.success) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); showToast(`${t.name} · +${t.points} (pending approval)`); reload?.(); }
      else showToast(res.message || 'Could not record', 'error');
    } catch (e) { showToast(e?.response?.data?.message || 'Could not record', 'error'); }
    finally { setTapping(null); }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={COLORS.primary} />}>
        <LinearGradient colors={[COLORS.ink, COLORS.inkSoft, COLORS.primaryDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + SP.lg }]}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.navigate('Leaderboard')} hitSlop={8} style={styles.hIcon}><Ionicons name="trophy-outline" size={18} color={COLORS.white} /></Pressable>
            <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8} style={styles.hIcon}><Ionicons name="settings-outline" size={18} color={COLORS.white} /></Pressable>
          </View>

          <View style={styles.brand}>
            <View style={styles.logoBadge}>
              <Ionicons name="link" size={26} color={COLORS.gold} />
            </View>
            <Text style={styles.brandTitle}>Keep Konnected</Text>
            <Text style={styles.brandTagline}>KARO INDIA FOUNDATION INITIATIVE</Text>
            {!!user?.company?.name && (
              <View style={styles.companyPill}>
                <Ionicons name="business" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={styles.companyTxt}>{user.company.name}</Text>
              </View>
            )}
          </View>

          <View style={styles.hairline} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Hello,</Text>
              <Text style={styles.name}>{user?.name?.split(' ')[0]}</Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.clock}>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
              <Text style={styles.today}>{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
              <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.14)', marginTop: SP.sm }]}>
                <View style={[styles.dot, { backgroundColor: st.c }]} /><Text style={styles.pillTxt}>{st.t}</Text>
              </View>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.stat}><Text style={styles.statNum}>{time(day?.checkIn)}</Text><Text style={styles.statLbl}>Check in</Text></View>
            <View style={styles.statDiv} />
            <View style={styles.stat}><Text style={styles.statNum}>{time(day?.checkOut)}</Text><Text style={styles.statLbl}>Check out</Text></View>
            <View style={styles.statDiv} />
            <View style={styles.stat}><Text style={[styles.statNum, { color: COLORS.gold }]}>{day?.points ?? 0}</Text><Text style={styles.statLbl}>Points</Text></View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={[styles.progressCard, SHADOW.card]}>
            <Ionicons name="checkmark-done-circle" size={22} color={COLORS.primary} />
            <Text style={styles.progressTxt}>Tasks done today: <Text style={{ fontWeight: '800', color: COLORS.text }}>{prog.done}/{prog.total}</Text></Text>
          </View>
          {showTasks && (
            <View style={styles.tasksBlock}>
              <Text style={styles.tasksHead}>My Tasks</Text>
              {allTasks.map((t) => {
                const st = taskState(t);
                const busy = tapping === t.id;
                return (
                  <Pressable key={t.id} onPress={() => onTapTask(t)} disabled={busy || st !== 'open'}
                    style={({ pressed }) => [
                      styles.taskBtn, SHADOW.card,
                      st === 'done' && styles.taskDone,
                      st === 'open' && styles.taskOpen,
                      (st === 'soon' || st === 'late') && styles.taskLocked,
                      pressed && st === 'open' && { opacity: 0.9 },
                    ]}>
                    <View style={[styles.taskIcon,
                      st === 'done' && { backgroundColor: COLORS.successTint },
                      (st === 'soon' || st === 'late') && { backgroundColor: COLORS.surfaceAlt }]}>
                      <Ionicons
                        name={st === 'done' ? 'checkmark-circle' : st === 'soon' ? 'time-outline' : st === 'late' ? 'lock-closed' : (t.icon || 'ellipse-outline')}
                        size={20}
                        color={st === 'done' ? COLORS.success : st === 'open' ? COLORS.primary : COLORS.textMute} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskName, (st === 'soon' || st === 'late') && { color: COLORS.textMute }]}>{t.name}</Text>
                      <Text style={styles.taskSub}>
                        {st === 'done' ? 'Done · nice one! (pending approval)'
                          : st === 'soon' ? `Opens at ${fmtMin(t.window.start)}`
                          : st === 'late' ? 'Too late — you missed this'
                          : `Open till ${fmtMin(t.window.end)}`}
                      </Text>
                    </View>
                    {busy ? <ActivityIndicator size="small" color={COLORS.primary} />
                      : st === 'done' ? <Ionicons name="checkmark-done" size={20} color={COLORS.success} />
                      : st === 'open' ? <View style={styles.taskPts}><Text style={styles.taskPtsTxt}>+{t.points}</Text></View>
                      : <Ionicons name={st === 'soon' ? 'hourglass-outline' : 'close-circle-outline'} size={18} color={COLORS.textMute} />}
                  </Pressable>
                );
              })}
            </View>
          )}

          {!showTasks && (
            <Text style={styles.note}>{allTasks.length === 0 ? 'No tasks set up yet.' : "That's all your tasks for today — see you tomorrow."}</Text>
          )}
        </View>
      </ScrollView>

      {/* The Actions trigger — opens the "What do you want to do?" sheet */}

    </View>
  );
}
const Counter = ({ n, label, c }) => (
  <View style={styles.counter}><Text style={[styles.counterN, { color: c }]}>{n}</Text><Text style={styles.counterL}>{label}</Text></View>
);
const styles = StyleSheet.create({
  tasksBlock: { marginTop: SP.md },
  tasksHead: { ...TYPE.title, color: COLORS.text, marginBottom: SP.sm },
  taskBtn: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SP.sm },
  taskIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  taskName: { ...TYPE.title, color: COLORS.text },
  taskSub: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  taskDone: { backgroundColor: COLORS.successTint, borderColor: '#A7F3C0' },
  taskOpen: { borderColor: COLORS.primary, borderWidth: 1.5 },
  taskLocked: { opacity: 0.7 },
  taskPts: { backgroundColor: COLORS.goldTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  taskPtsTxt: { ...TYPE.cap, color: COLORS.gold, fontWeight: '800' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: SP.sm, marginBottom: SP.sm },
  brand: { alignItems: 'center', marginTop: SP.xs },
  logoBadge: { flexDirection: 'row', alignItems: 'center', width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: SP.md },
  brandTitle: { fontSize: 25, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  brandTagline: { fontSize: 10.5, color: COLORS.gold, fontWeight: '800', letterSpacing: 1.8, marginTop: 5 },
  companyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.md, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill },
  companyTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '700' },
  rightCol: { alignItems: 'flex-end' },
  clock: { fontSize: 17, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  today: { ...TYPE.cap, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  hairline: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: SP.lg },
  hIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  pillRow: { alignSelf: 'flex-start', marginTop: SP.md, flexDirection: 'row' },
  countersRow: { flexDirection: 'row', gap: SP.md, marginTop: SP.md },
  counter: { flex: 1, backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, padding: SP.md, alignItems: 'center' },
  counterN: { fontSize: 22, fontWeight: '800' },
  counterL: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },
  annCard: { backgroundColor: COLORS.surface, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, padding: SP.lg, marginTop: SP.md },
  annHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SP.sm },
  annTitle: { ...TYPE.title, color: COLORS.text },
  annBody: { ...TYPE.body, color: COLORS.textSoft, lineHeight: 20 },
  annMeta: { ...TYPE.cap, color: COLORS.textMute, marginTop: SP.sm },
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.xl, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SP.md },
  hello: { ...TYPE.label, color: 'rgba(255,255,255,0.65)' },
  name: { ...TYPE.h1, color: COLORS.white, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillTxt: { ...TYPE.cap, color: COLORS.white },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: SP.lg, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: SP.md },
  stat: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  statNum: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  statLbl: { ...TYPE.cap, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  section: { paddingHorizontal: SP.lg, marginTop: SP.lg },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: COLORS.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: COLORS.border },
  progressTxt: { ...TYPE.body, color: COLORS.textSoft },
  note: { ...TYPE.body, color: COLORS.textMute, marginTop: SP.lg, lineHeight: 20 },
});
