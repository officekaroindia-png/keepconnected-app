import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffDashboard, staffLeaves } from '../../api/admin';
import { myAttendance, myLeaves } from '../../api/day';
import { hhmm } from '../../utils/timeFormat';
let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch {}
const SUNDAY_ANIM = (() => { try { return require('../../../assets/animations/sunday.json'); } catch { return null; } })();

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const todayStr = () => new Intl.DateTimeFormat('en-CA').format(new Date());

const STATUS_MAP = {
  ontime:       { label: 'On Time',   color: COLORS.success },
  little_late:  { label: 'Lt. Late',  color: COLORS.warn },
  late:         { label: 'Very Late', color: '#EA580C' },
  half_day:     { label: 'Half Day',  color: '#7C3AED' },
  absent:       { label: 'Absent',    color: COLORS.danger },
  off:          { label: 'Off',       color: COLORS.textMute },
  holiday:      { label: 'Holiday',   color: COLORS.primary },
  wfh:          { label: 'WFH',       color: '#0891B2' },
  wfh_pending:  { label: 'WFH',       color: '#0891B2' },
  pending:      { label: '—',         color: COLORS.textMute },
};

// Fixed widths for the outer columns; the two middle columns share the rest
// via flex so the row fills edge-to-edge with no stranded gap. Header cells use
// these exact same values, so every column lines up perfectly.
const COL = {
  date:   54,
  status: 118,
};

function OffDayRow({ dayLabel, dateLabel, isHoliday }) {
  const [lottieFailed, setLottieFailed] = React.useState(false);
  const canLottie = !isHoliday && !!LottieView && !!SUNDAY_ANIM && !lottieFailed;

  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isHoliday) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [isHoliday]);
  const hScale = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] });

  const bgColors = isHoliday
    ? ['#1E3A8A', '#3730A3', '#1E3A8A']
    : ['#0EA5E9', '#06B6D4', '#14B8A6'];
  const tag      = isHoliday ? 'Holiday' : 'Rest Day';
  const tagColor = isHoliday ? '#DBEAFE' : '#FFFFFF';
  const subLine  = isHoliday ? 'Public Holiday 🎉' : 'Sunday · Recharge 🩵';

  return (
    <View style={offStyles.wrapper}>
      <LinearGradient
        colors={bgColors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={offStyles.gradient}
      >
        <View style={offStyles.blob1} />
        <View style={offStyles.blob2} />

        {/* Date — same width as the table's date column so it lines up */}
        <View style={[offStyles.dateBlock, { width: COL.date }]}>
          <Text style={offStyles.dateMain}>{dateLabel}</Text>
          <Text style={offStyles.dateSub}>{dayLabel}</Text>
        </View>

        {canLottie ? (
          <LottieView
            source={SUNDAY_ANIM}
            autoPlay loop resizeMode="contain"
            style={offStyles.lottie}
            onAnimationFailure={() => setLottieFailed(true)}
          />
        ) : isHoliday ? (
          <Animated.Text style={[offStyles.emoji, { transform: [{ scale: hScale }] }]}>🎉</Animated.Text>
        ) : (
          <Text style={offStyles.emoji}>😴</Text>
        )}

        <View style={offStyles.textBlock}>
          <Text style={[offStyles.tag, { color: tagColor }]}>{tag}</Text>
          <Text style={offStyles.subLine}>{subLine}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const offStyles = StyleSheet.create({
  wrapper:   { marginHorizontal: SP.md, marginTop: SP.sm, borderRadius: R.md, overflow: 'hidden' },
  gradient:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: 12, position: 'relative' },
  blob1:     { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.15)', top: -25, right: 70 },
  blob2:     { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.10)', bottom: -20, right: 8 },
  dateBlock: { marginRight: SP.sm },
  dateMain:  { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.92)', fontVariant: ['tabular-nums'] },
  dateSub:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.60)', marginTop: 2 },
  lottie:    { width: 46, height: 46 },
  emoji:     { fontSize: 24, marginRight: SP.sm },
  textBlock: { marginLeft: SP.xs, flex: 1 },
  tag:       { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  subLine:   { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
});

const SummaryChip = ({ icon, value, label, color }) => (
  <View style={styles.chip}>
    <Ionicons name={icon} size={13} color={color} />
    <Text style={styles.chipVal}>{value}</Text>
    <Text style={styles.chipLbl}>{label}</Text>
  </View>
);

export default function StaffMonthlyScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { id, name, selfView } = route.params;
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [leaves, setLeaves] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await (selfView ? myAttendance(ym.y, ym.m) : staffDashboard(id, ym.y, ym.m)));
    } catch {}
    // Leave balance is best-effort — a failure here shouldn't blank the timeline.
    try {
      setLeaves(await (selfView ? myLeaves(ym.y, ym.m) : staffLeaves(id, ym.y, ym.m)));
    } catch { setLeaves(null); }
    finally { setLoading(false); }
  }, [id, ym]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shift = (d) => setYm(({ y, m }) => {
    let nm = m + d, ny = y;
    if (nm < 1)  { nm = 12; ny--; }
    if (nm > 12) { nm = 1;  ny++; }
    return { y: ny, m: nm };
  });

  const today = todayStr();

  // Month overview — derived from the summary the API already returns.
  const sum = useMemo(() => {
    const s = data?.summary || {};
    return {
      onTime: s.ontime || 0,
      late:   (s.little_late || 0) + (s.late || 0),
      absent: s.absent || 0,
    };
  }, [data]);

  const visibleRows = useMemo(
    () => (data?.rows || []).filter((r) => r.date <= today).reverse(),
    [data, today]
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>Timelines · {name}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.monthRow}>
          <Pressable onPress={() => shift(-1)} hitSlop={6} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={16} color={COLORS.white} />
            <Text style={styles.navTxt}>Prev</Text>
          </Pressable>
          <Text style={styles.month}>{MONTHS[ym.m]} {ym.y}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={6} style={styles.navBtn}>
            <Text style={styles.navTxt}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
          </Pressable>
        </View>

        {/* Month overview */}
        {!!data && (
          <View style={styles.summaryRow}>
            <SummaryChip icon="checkmark-circle" value={sum.onTime} label="On time" color="#6EE7B7" />
            <SummaryChip icon="time"             value={sum.late}   label="Late"    color="#FCD34D" />
            <SummaryChip icon="close-circle"     value={sum.absent} label="Absent"  color="#FCA5A5" />
          </View>
        )}
      </LinearGradient>

      {/* Leave balance card — how many paid leaves this person has and has used */}
      {leaves && (
        <View style={styles.leaveCard}>
          <View style={styles.leaveCardTop}>
            <View style={styles.leaveCardHead}>
              <Ionicons name={leaves.carryOver ? 'albums' : 'sunny'} size={14} color={COLORS.primary} />
              <Text style={styles.leaveCardTitle}>Paid Leaves</Text>
              <View style={styles.leaveModePill}>
                <Text style={styles.leaveModeTxt}>{leaves.carryOver ? 'Carry-over' : 'Monthly'}</Text>
              </View>
            </View>
            <View style={[styles.balPill, (leaves.balance <= 0) && styles.balPillBad]}>
              <Text style={[styles.balPillTxt, (leaves.balance <= 0) && styles.balPillTxtBad]}>
                {leaves.balance > 0 ? `${+leaves.balance.toFixed(2)} left` : leaves.balance === 0 ? 'None left' : `${Math.abs(+leaves.balance.toFixed(2))} over`}
              </Text>
            </View>
          </View>
          <View style={styles.leaveStatRow}>
            <View style={styles.leaveStat}>
              <Text style={styles.leaveStatNum}>{+(leaves.available ?? leaves.quota ?? 0).toFixed(2)}</Text>
              <Text style={styles.leaveStatLbl}>Available</Text>
            </View>
            <View style={styles.leaveStatDiv} />
            <View style={styles.leaveStat}>
              <Text style={styles.leaveStatNum}>{+(leaves.used ?? 0).toFixed(2)}</Text>
              <Text style={styles.leaveStatLbl}>Used</Text>
            </View>
            <View style={styles.leaveStatDiv} />
            <View style={styles.leaveStat}>
              <Text style={styles.leaveStatNum}>{leaves.carriedLeaves ? `+${+leaves.carriedLeaves.toFixed(2)}` : '—'}</Text>
              <Text style={styles.leaveStatLbl}>Carried in</Text>
            </View>
          </View>
        </View>
      )}

      {/* Table header — widths match COL exactly so columns line up */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { width: COL.date }]}>Date</Text>
        <Text style={[styles.th, { flex: 1 }]}>Check In</Text>
        <Text style={[styles.th, { flex: 1 }]}>Hours</Text>
        <Text style={[styles.th, { width: COL.status, textAlign: 'right' }]}>Status</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />}

        {!loading && visibleRows.map((r) => {
          const isOff     = r.status === 'off';
          const isHoliday = r.status === 'holiday';
          const [, mm, dd] = r.date.split('-');
          const dateLabel  = `${dd}/${mm}`;
          const dayLabel   = r.day;

          if (isOff || isHoliday) {
            return (
              <OffDayRow
                key={r.date}
                dateLabel={dateLabel}
                dayLabel={dayLabel}
                isHoliday={isHoliday}
              />
            );
          }

          const ci = hhmm(r.checkIn);
          const wm = r.workedMinutes;
          const workedHrs = wm
            ? `${Math.floor(wm / 60)}h ${wm % 60 > 0 ? `${wm % 60}m` : ''}`.trim()
            : null;
          const st = STATUS_MAP[r.status] || { label: r.status || '—', color: COLORS.textMute };
          const ciColor = r.status === 'late'        ? '#EA580C'
                        : r.status === 'little_late' ? COLORS.warn
                        : COLORS.success;
          const isToday = r.date === today;

          return (
            <Pressable
              key={r.date}
              onPress={() => selfView
                ? navigation.navigate('MyDayTimeline', { date: r.date })
                : navigation.navigate('StaffTimeline', { id, name, date: r.date })}
              style={({ pressed }) => [
                styles.row,
                isToday && styles.rowToday,
                pressed && { backgroundColor: COLORS.surfaceAlt },
              ]}
            >
              {isToday && <View style={styles.todayBar} />}

              {/* Date */}
              <View style={{ width: COL.date }}>
                <Text style={[styles.dateMain, isToday && { color: COLORS.primary }]}>{dateLabel}</Text>
                <Text style={styles.dateSub}>{dayLabel}</Text>
              </View>

              {/* Check-in time */}
              <View style={[styles.cell, { flex: 1 }]}>
                {ci ? (
                  <View style={styles.inline}>
                    <Ionicons name="log-in-outline" size={13} color={ciColor} style={{ marginRight: 4 }} />
                    <Text style={[styles.ciTime, { color: ciColor }]}>{ci}</Text>
                  </View>
                ) : <Text style={styles.dash}>—</Text>}
              </View>

              {/* Hours worked */}
              <View style={[styles.cell, { flex: 1 }]}>
                {workedHrs ? (
                  <View style={styles.inline}>
                    <Ionicons name="time-outline" size={13} color={COLORS.textMute} style={{ marginRight: 4 }} />
                    <Text style={styles.hrsTxt}>{workedHrs}</Text>
                  </View>
                ) : <Text style={styles.dash}>—</Text>}
              </View>

              {/* Status (with an admin-verified shield inline when applicable) */}
              <View style={[styles.statusCell, { width: COL.status }]}>
                {r.adminActed && (
                  <View style={styles.admShield}>
                    <Ionicons name="shield-checkmark" size={11} color={COLORS.primary} />
                  </View>
                )}
                <View style={[styles.statusBadge, { backgroundColor: st.color + '18', borderColor: st.color + '55' }]}>
                  <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                  <Text style={[styles.statusTxt, { color: st.color }]} numberOfLines={1}>{st.label}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        {!loading && !visibleRows.length && (
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-clear-outline" size={44} color={COLORS.border} />
            <Text style={styles.dim}>No records for this month.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: SP.lg,
    paddingBottom: SP.lg,
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
  },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { ...TYPE.h2, fontSize: 18, color: COLORS.white, flex: 1, textAlign: 'center', marginHorizontal: SP.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.lg },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill,
  },
  navTxt: { ...TYPE.label, color: COLORS.white, fontWeight: '700' },
  month:  { fontSize: 17, fontWeight: '800', color: COLORS.white, letterSpacing: -0.2 },

  // Month overview chips
  summaryRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.lg },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: R.md, paddingVertical: 9, paddingHorizontal: 6,
  },
  chipVal: { fontSize: 15, fontWeight: '800', color: COLORS.white, fontVariant: ['tabular-nums'] },
  chipLbl: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  // ── Leave card ──────────────────────────────────────────────────────────────
  leaveCard: { backgroundColor: COLORS.surface, marginHorizontal: SP.md, marginTop: SP.md, marginBottom: SP.xs, borderRadius: R.lg, borderWidth: 1, borderColor: COLORS.border, padding: SP.md, ...SHADOW.card },
  leaveCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leaveCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaveCardTitle: { ...TYPE.cap, color: COLORS.textMute, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  leaveModePill: { backgroundColor: COLORS.primaryTint, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 },
  leaveModeTxt: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  balPill: { backgroundColor: COLORS.successTint, borderRadius: R.pill, paddingHorizontal: 11, paddingVertical: 4 },
  balPillBad: { backgroundColor: COLORS.dangerTint },
  balPillTxt: { fontSize: 12, fontWeight: '800', color: COLORS.success },
  balPillTxtBad: { color: COLORS.danger },
  leaveStatRow: { flexDirection: 'row', alignItems: 'center', marginTop: SP.md },
  leaveStat: { flex: 1, alignItems: 'center' },
  leaveStatDiv: { width: 1, height: 26, backgroundColor: COLORS.border },
  leaveStatNum: { fontSize: 18, fontWeight: '800', color: COLORS.text, fontVariant: ['tabular-nums'] },
  leaveStatLbl: { ...TYPE.cap, color: COLORS.textMute, marginTop: 2 },

  // ── Table header ────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.md,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMute,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  // ── Data rows ───────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: SP.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    position: 'relative',
  },
  rowToday: { backgroundColor: '#EFF6FF', borderBottomColor: '#DBEAFE' },
  todayBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: COLORS.primary },

  cell: { justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center' },

  // Date cell
  dateMain: { fontSize: 14, fontWeight: '800', color: COLORS.text, fontVariant: ['tabular-nums'] },
  dateSub:  { fontSize: 10, fontWeight: '700', color: COLORS.textMute, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Check-in
  ciTime: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Hours
  hrsTxt: { fontSize: 13.5, fontWeight: '700', color: COLORS.textSoft, fontVariant: ['tabular-nums'] },

  // Status column
  statusCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  admShield: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  dash: { fontSize: 14, color: COLORS.textMute, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', marginTop: 48, gap: SP.sm },
  dim:  { ...TYPE.body, color: COLORS.textMute, textAlign: 'center' },
});
