import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { hhmm } from '../../utils/timeFormat';
import { staffStatus } from '../../api/admin';
import AwayHistorySheet from '../../components/AwayHistorySheet';

// Right-side status square — reflects the person's LIVE current activity today, with a
// distinct, beautiful icon for each state: checked in / at office / leaving / reaching /
// lunch / work-from-home / back-to-work / checked out. Falls back to the base day status.
const ACTIVITY = {
  checkin:    { icon: 'log-in',      c: COLORS.success, bg: COLORS.successTint, label: 'Checked in' },
  atoffice:   { icon: 'business',    c: '#0E7490',      bg: '#E0F2F1',          label: 'At office' },
  leaving:    { icon: 'walk',        c: COLORS.warn,    bg: COLORS.goldTint,    label: 'Leaving' },
  reached:    { icon: 'flag',        c: COLORS.success, bg: COLORS.successTint, label: 'Reached' },
  lunch:      { icon: 'restaurant',  c: '#EA580C',      bg: '#FFEDD5',          label: 'Lunch' },
  lunch_in:   { icon: 'restaurant',  c: '#EA580C',      bg: '#FFEDD5',          label: 'On lunch' },
  lunch_out:  { icon: 'briefcase',   c: '#0E7490',      bg: '#E0F2F1',          label: 'Working' },
  wfh:        { icon: 'home',        c: COLORS.primary, bg: COLORS.primaryTint, label: 'WFH' },
  remove_wfh: { icon: 'briefcase',   c: '#0E7490',      bg: '#E0F2F1',          label: 'Working' },
  checkout:   { icon: 'log-out',     c: COLORS.danger,  bg: COLORS.dangerTint,  label: 'Checked out' },
  custom:     { icon: 'location',    c: COLORS.primary, bg: COLORS.primaryTint, label: 'On location' },
  off:        { icon: 'happy',       c: '#2563EB',      bg: COLORS.primaryTint, label: 'Off day' },
  holiday:    { icon: 'sunny',       c: COLORS.gold,    bg: COLORS.goldTint,    label: 'Holiday' },
  absent:     { icon: 'close',       c: COLORS.danger,  bg: COLORS.dangerTint,  label: 'Absent' },
  none:       { icon: 'ellipsis-horizontal', c: COLORS.textMute, bg: COLORS.surfaceAlt, label: '—' },
};
const squareFor = (s) => {
  let key = s.currentActivity;
  if (!key || key === 'none') {
    if (s.checkOut) key = 'checkout';
    else if (s.status === 'off' || s.status === 'holiday' || s.status === 'absent') key = s.status;
    else if (s.atOffice) key = 'atoffice';
    else if (s.checkIn) key = 'checkin';
    else key = 'none';
  }
  const base = ACTIVITY[key] || ACTIVITY.none;
  if (key === 'custom') return { ...base, icon: s.currentActivityIcon || base.icon, label: s.currentActivityName || base.label };
  return base;
};

// Use IST date — NOT device-local date — so it matches the server's localDate()
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

// Extract minutes-since-midnight from a UTC timestamp in IST (Asia/Kolkata).
// Must NOT use getHours()/getMinutes() — those use the device's local timezone
// which will be wrong on any device not set to IST.
const toISTMinutes = (dateVal) => {
  const d = new Date(dateVal);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
};

// Colour the check-in time by the resolved status bucket (which already accounts for the
// on-time window + grace on the server) rather than recomputing here.
const STATUS_COLOR = { ontime: COLORS.success, little_late: COLORS.warn, late: COLORS.danger, half_day: '#7C3AED', wfh: COLORS.success, absent: COLORS.danger };
const checkInColorByStatus = (checkInTime, status) => {
  if (!checkInTime) return COLORS.textMute;
  return STATUS_COLOR[status] || COLORS.success;
};

// Swipe a card LEFT to reveal a Dashboard button (monthly attendance chart).
// Tap the status icon to open that person's timeline for today.
function StaffCard({ s, date, isToday, taskList, settings, navigation, onAwayPress }) {
  const sq = squareFor(s);
  const tx = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const REVEAL = 96;

  const snap = (to) => { openRef.current = to !== 0; Animated.spring(tx, { toValue: to, useNativeDriver: true, bounciness: 4 }).start(); };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_e, g) => {
      // Card slides RIGHT (positive tx) revealing the Dashboard button underneath on the LEFT.
      let x = (openRef.current ? REVEAL : 0) + g.dx;
      x = Math.max(0, Math.min(REVEAL, x));
      tx.setValue(x);
    },
    onPanResponderRelease: (_e, g) => {
      const x = (openRef.current ? REVEAL : 0) + g.dx;
      snap(x > REVEAL / 2 ? REVEAL : 0);
    },
  })).current;

  const openDay = () => navigation.navigate('StaffTimeline', { id: s.id, name: s.name, date });
  const openDashboard = () => { snap(0); navigation.navigate('AttendanceDashboard', { id: s.id, name: s.name }); };
  const awayShow = (s.awayUsed || 0) > 0 || (s.awayAllowed || 0) > 0 || s.awayUnlimited;

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
            <TaskChecks taskList={taskList} tasksDone={s.tasksDone} />
            <View style={styles.timesRow}>
              <Text style={[styles.tinyTime, { color: checkInColorByStatus(s.checkInTime, s.status) }]}>{s.checkInTime ? hhmm(s.checkInTime) : '---'}</Text>
              <Text style={styles.timeSep}>→</Text>
              <Text style={[styles.tinyTime, { color: s.checkOutTime ? COLORS.danger : COLORS.textMute }]}>{s.checkOutTime ? hhmm(s.checkOutTime) : '---'}</Text>
              {awayShow && (
                <Pressable
                  onPress={() => onAwayPress && onAwayPress(s)}
                  style={({ pressed }) => [styles.awayPill, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                >
                  <Ionicons name="airplane" size={11} color="#7C3AED" />
                  <Text style={styles.awayPillTxt}>{s.awayUnlimited ? `${s.awayUsed || 0} · ∞` : `${s.awayUsed || 0}/${s.awayAllowed || 0}`}</Text>
                </Pressable>
              )}
              {s.offsiteAuthToday && (
                <View style={styles.offsitePill}>
                  <Ionicons name="map" size={10} color="#0891B2" />
                  <Text style={styles.offsitePillTxt}>Offsite</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
        <Pressable onPress={openDay} style={styles.squareCol}>
          <View style={[styles.square, { backgroundColor: sq.bg }]}>
            <Ionicons name={sq.icon} size={20} color={sq.c} />
          </View>
          <Text style={[styles.squareLbl, { color: sq.c }]} numberOfLines={1}>{sq.label}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const TaskChecks = ({ taskList, tasksDone }) => {
  if (!taskList?.length) return null;
  const doneSet = new Set(tasksDone || []);
  if (taskList.length <= 5) return (
    <View style={styles.checks}>
      {taskList.map((t) => (
        <Ionicons key={t.id} name={doneSet.has(t.id) ? 'checkmark-circle' : 'ellipse-outline'} size={23}
          color={doneSet.has(t.id) ? COLORS.success : COLORS.border} style={{ marginRight: 5 }} />
      ))}
    </View>
  );
  const done = taskList.filter((t) => doneSet.has(t.id)).length;
  return (
    <View style={[styles.taskBadge, done >= taskList.length && styles.taskBadgeDone]}>
      <Ionicons name={done >= taskList.length ? 'checkmark-done' : 'checkbox-outline'} size={13}
        color={done >= taskList.length ? COLORS.success : done > 0 ? COLORS.primary : COLORS.textMute} />
      <Text style={[styles.taskBadgeTxt, { color: done >= taskList.length ? COLORS.success : done > 0 ? COLORS.primary : COLORS.textMute }]}>
        {done}/{taskList.length}
      </Text>
    </View>
  );
};

const pad2 = (n) => String(n).padStart(2, '0');
const shiftDateStr = (dateStr, days) => { const [y, m, d] = dateStr.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + days); return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`; };
const prettyDay = (dateStr) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }); };

export default function StaffStatusScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState({ staff: [], taskCount: 3 });
  const [loading, setLoading] = useState(true);
  const [awaySheet, setAwaySheet] = useState(null); // { id, name, awayUsed, awayAllowed, awayUnlimited }
  const load = useCallback(async () => { setLoading(true); try { setData(await staffStatus(date)); } catch {} finally { setLoading(false); } }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const isToday = date === todayLocal();
  const go = (d) => setDate((cur) => { const next = shiftDateStr(cur, d); return next > todayLocal() ? cur : next; });
  const openAwaySheet = (s) => setAwaySheet({ id: s.id, name: s.name, awayUsed: s.awayUsed, awayAllowed: s.awayAllowed, awayUnlimited: s.awayUnlimited });

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></Pressable>
        <Text style={styles.barTitle}>Staff Status</Text>
        <Pressable onPress={load} hitSlop={10}><Ionicons name="refresh" size={22} color={COLORS.primary} /></Pressable>
      </View>
      <View style={styles.dateBar}>
        <Pressable onPress={() => go(-1)} hitSlop={8} style={styles.dateArrow}><Ionicons name="chevron-back" size={20} color={COLORS.primary} /></Pressable>
        <View style={styles.dateCenter}>
          <Ionicons name="calendar-outline" size={15} color={COLORS.textSoft} />
          <Text style={styles.dateTxt}>{isToday ? 'Today' : prettyDay(date)}</Text>
        </View>
        <Pressable onPress={() => go(1)} hitSlop={8} disabled={isToday} style={[styles.dateArrow, isToday && { opacity: 0.3 }]}><Ionicons name="chevron-forward" size={20} color={COLORS.primary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {data.staff.map((s) => (
          <StaffCard key={s.id} s={s} date={date} isToday={isToday} taskList={data.taskList || []} settings={data.settings} navigation={navigation} onAwayPress={openAwaySheet} />
        ))}
        <Text style={styles.hint}>Tap the status icon for that day's timeline · swipe a card right for the monthly dashboard · ✈ tap away pill for full check-in history.</Text>
      </ScrollView>

      <AwayHistorySheet
        visible={!!awaySheet}
        staffId={awaySheet?.id}
        staffName={awaySheet?.name}
        awayUsed={awaySheet?.awayUsed}
        awayAllowed={awaySheet?.awayAllowed}
        awayUnlimited={awaySheet?.awayUnlimited}
        onClose={() => setAwaySheet(null)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: SP.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  barTitle: { ...TYPE.h2, color: COLORS.text },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingVertical: SP.sm, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dateArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateTxt: { ...TYPE.title, fontSize: 15, color: COLORS.text },
  awayPill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8, backgroundColor: '#F3E8FF', borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 },
  awayPillTxt: { fontSize: 10, fontWeight: '800', color: '#7C3AED', fontVariant: ['tabular-nums'] },
  offsitePill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 6, backgroundColor: '#E0F2FE', borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 2 },
  offsitePillTxt: { fontSize: 10, fontWeight: '800', color: '#0891B2' },
  swipeWrap: { position: 'relative', justifyContent: 'center', marginBottom: SP.sm },
  revealBtn: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 96, backgroundColor: COLORS.primary, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', gap: 4 },
  revealTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: R.md, padding: SP.md, borderWidth: 1, borderColor: COLORS.border },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SP.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { ...TYPE.title, color: COLORS.textSoft },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { ...TYPE.title, color: COLORS.text },
  timesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tinyTime: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeSep: { fontSize: 10, color: COLORS.textMute },
  checks: { flexDirection: 'row', alignItems: 'center' },
  taskBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  taskBadgeDone: { opacity: 0.7 },
  taskBadgeTxt: { fontSize: 11, fontWeight: '700' },
  square: { width: 48, height: 48, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  squareCol: { alignItems: 'center', marginLeft: SP.md, width: 64 },
  squareLbl: { fontSize: 10, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  hint: { ...TYPE.cap, color: COLORS.textMute, textAlign: 'center', marginTop: SP.md, lineHeight: 17 },
});