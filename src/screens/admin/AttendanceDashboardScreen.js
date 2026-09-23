import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, FlatList, Dimensions, RefreshControl, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffDashboard } from '../../api/admin';
import { myAttendance } from '../../api/day';
let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch {}
const SUNDAY_ANIM = (() => { try { return require('../../../assets/animations/sunday.json'); } catch { return null; } })();


const MARK = {
  ontime:      { icon: 'ellipse',       c: '#22C55E' },
  little_late: { icon: 'ellipse',       c: '#F59E0B' },
  late:        { icon: 'ellipse',       c: '#EF4444' },
  half_day:    { icon: 'cut',           c: '#7C3AED' },
  wfh:         { icon: 'home',          c: COLORS.primary },
  absent:      { icon: 'close-circle',  c: '#EF4444' },
  off:         { icon: 'happy-outline', c: '#2563EB' },
  holiday:     { icon: 'ellipse',       c: '#38BDF8' },
  pending:     { icon: 'ellipse',       c: '#CBD5E1' },
};
const LEGEND = [
  ['Present on time', 'ontime'], ['Little Late', 'little_late'], ['Late', 'late'],
  ['Half Day', 'half_day'],
  ['Absent', 'absent'], ['Off day', 'off'], ['National holiday', 'holiday'], ['Pending', 'pending'],
];
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const WINDOW_MONTHS = 12;

const buildMonths = (n) => {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
};
const keyOf = ({ year, month }) => `${year}-${month}`;
const isCurrent = ({ year, month }) => {
  const n = new Date();
  return year === n.getFullYear() && month === n.getMonth() + 1;
};

// Format time as HH:MM (24h, no am/pm)
const fmtTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// Animated off-day row — full width banner
function OffDayRow({ dateLabel, dayLabel, isHoliday }) {
  const [lottieFailed, setLottieFailed] = React.useState(false);
  const canLottie = !isHoliday && !!LottieView && !!SUNDAY_ANIM && !lottieFailed;

  // For holiday: gentle pulse on the emoji
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
  const hScale = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] });

  // Sunday: soft purple gradient; Holiday: indigo-blue
  const bgColors = isHoliday
    ? ['#1E3A8A', '#3730A3', '#1E3A8A']
    : ['#0EA5E9', '#06B6D4', '#14B8A6'];   // sky → cyan → teal — bright, shiny, no dark

  const tag      = isHoliday ? 'Holiday' : 'Rest Day';
  const tagColor = isHoliday ? '#DBEAFE' : '#FFFFFF';
  const subLine  = isHoliday ? 'Public Holiday 🎉' : 'Sunday · Recharge 🩵';

  return (
    <LinearGradient
      colors={bgColors}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={offRow.wrap}
    >
      {/* Decorative blobs for depth */}
      <View style={offRow.blob1} />
      <View style={offRow.blob2} />

      {/* Date */}
      <View style={offRow.dateBlock}>
        <Text style={offRow.dateMain}>{dateLabel}</Text>
        <Text style={offRow.dateSub}>{dayLabel}</Text>
      </View>

      {/* Sunday Lottie OR holiday emoji */}
      {canLottie ? (
        <LottieView
          source={SUNDAY_ANIM}
          autoPlay
          loop
          resizeMode="contain"
          style={offRow.lottie}
          onAnimationFailure={() => setLottieFailed(true)}
        />
      ) : isHoliday ? (
        <Animated.Text style={[offRow.emoji, { transform: [{ scale: hScale }] }]}>🎉</Animated.Text>
      ) : (
        <Text style={offRow.emoji}>😴</Text>
      )}

      {/* Text block */}
      <View style={offRow.textBlock}>
        <Text style={[offRow.tag, { color: tagColor }]}>{tag}</Text>
        <Text style={offRow.subLine}>{subLine}</Text>
      </View>

      <View style={{ flex: 1 }} />
      <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.25)" />
    </LinearGradient>
  );
}
const offRow = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(6,182,212,0.3)',
    overflow: 'hidden', position: 'relative',
  },
  blob1: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -30, right: 60,
  },
  blob2: {
    position: 'absolute', width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -25, right: 10,
  },
  dateBlock: { width: 54, marginRight: SP.xs },
  dateMain:  { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.75)', fontVariant: ['tabular-nums'] },
  dateSub:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  lottie:    { width: 52, height: 52 },
  emoji:     { fontSize: 26, marginRight: SP.sm },
  textBlock: { marginLeft: SP.xs },
  tag:       { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  subLine:   { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 2 },
});

// ── One month's page ──────────────────────────────────────────────────────────
function MonthPage({ staffId, self, ym, width, cachedData, onData, navigation, staffName }) {
  const [data, setData] = useState(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMonth = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const d = self
        ? await myAttendance(ym.year, ym.month)
        : await staffDashboard(staffId, ym.year, ym.month);
      setData(d);
      onData?.(keyOf(ym), d);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [staffId, self, ym, onData]);

  useEffect(() => {
    if (!cachedData) fetchMonth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ width }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMonth(true)} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {data && (
          <>
            {/* ── Attendance table ── */}
            <View style={[styles.table, SHADOW.card]}>
              {/* Header row */}
              <View style={styles.thead}>
                <Text style={[styles.th, styles.colDate]}>Date</Text>
                <Text style={[styles.th, styles.colCheckin]}>Check In</Text>
                <Text style={[styles.th, styles.colHrs, { textAlign: 'right' }]}>Hrs</Text>
                <Text style={[styles.th, styles.colAdmin, { textAlign: 'center' }]}>Admin</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Status</Text>
              </View>

              {data.rows.map((r) => {
                const isOff     = r.status === 'off';
                const isHoliday = r.status === 'holiday';

                // Date parts
                const [, mm, dd] = r.date.split('-');
                const dateLabel  = `${dd}/${mm}`;
                const dayLabel   = r.day; // Mon, Tue …

                if (isOff || isHoliday) {
                  return <OffDayRow key={r.date} dateLabel={dateLabel} dayLabel={dayLabel} isHoliday={isHoliday} />;
                }

                const m = MARK[r.status] || MARK.pending;
                const ciTime = fmtTime(r.checkIn);
                const ciColor = r.status === 'late' ? '#EF4444'
                  : r.status === 'little_late' ? '#F59E0B'
                  : COLORS.success;
                const wm = r.workedMinutes;
                const hrsLabel = wm
                  ? `${Math.floor(wm / 60)}:${String(wm % 60).padStart(2, '0')}`
                  : '–';

                return (
                  <Pressable
                    key={r.date}
                    onPress={() => {
                      if (self) navigation?.navigate('MyDayTimeline', { date: r.date });
                      else navigation?.navigate('StaffTimeline', { id: staffId, name: staffName, date: r.date });
                    }}
                    style={({ pressed }) => [styles.tr, pressed && { backgroundColor: COLORS.surfaceAlt }]}
                  >
                    {/* Date — two-line: DD/MM above, Day below */}
                    <View style={[styles.cell, styles.colDate]}>
                      <Text style={styles.tdDate}>{dateLabel}</Text>
                      <Text style={styles.tdDay}>{dayLabel}</Text>
                    </View>

                    {/* Check-in (24h, no am/pm) */}
                    <View style={[styles.cell, styles.colCheckin]}>
                      <Text style={[styles.td, { color: ciTime ? ciColor : COLORS.textMute, fontVariant: ['tabular-nums'] }]}>
                        {ciTime ?? '—'}
                      </Text>
                    </View>

                    {/* Hours */}
                    <View style={[styles.cell, styles.colHrs, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.td, { color: wm ? COLORS.text : COLORS.textMute, fontVariant: ['tabular-nums'] }]}>
                        {hrsLabel}
                      </Text>
                    </View>

                    {/* Admin — show name if available, else just icon */}
                    <View style={[styles.cell, styles.colAdmin, { alignItems: 'center' }]}>
                      {r.adminActed ? (
                        <View style={styles.adminCell}>
                          <Ionicons name="build" size={12} color={COLORS.primary} />
                          {r.adminActedBy ? (
                            <Text style={styles.adminName} numberOfLines={1}>{r.adminActedBy}</Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={styles.dash}>–</Text>
                      )}
                    </View>

                    {/* Status dot + chevron */}
                    <View style={[styles.cell, { flex: 1, alignItems: 'center', flexDirection: 'row', gap: 1, justifyContent: 'center' }]}>
                      <Ionicons name={m.icon} size={24} color={m.c} />
                      <Ionicons name="chevron-forward" size={12} color={COLORS.textMute} />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Summary legend ── */}
            <Text style={styles.calcTitle}>Attendance calculation</Text>
            <View style={[styles.calc, SHADOW.card]}>
              {LEGEND.map(([label, key]) => {
                const mk = MARK[key];
                return (
                  <View key={key} style={styles.calcRow}>
                    <Ionicons name={mk.icon} size={24} color={mk.c} />
                    <Text style={styles.calcLabel}>{label}</Text>
                    <Text style={styles.calcNum}>{data.summary[key] ?? 0}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function AttendanceDashboardScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { id, name, self } = route.params || {};
  const [width, setWidth] = useState(Dimensions.get('window').width);

  const months = useMemo(() => buildMonths(WINDOW_MONTHS), []);
  const initialIndex = months.length - 1;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentYm = months[currentIndex];

  const cache = useRef({});
  const listRef = useRef(null);

  const handlePageData = useCallback((key, d) => { cache.current[key] = d; }, []);

  const onMomentumEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== currentIndex) setCurrentIndex(idx);
  }, [width, currentIndex]);

  const goToCurrent = useCallback(() => {
    listRef.current?.scrollToIndex({ index: initialIndex, animated: true });
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const stepMonth = useCallback((dir) => {
    const target = Math.min(months.length - 1, Math.max(0, currentIndex + dir));
    if (target === currentIndex) return;
    listRef.current?.scrollToIndex({ index: target, animated: true });
  }, [currentIndex, months.length]);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const d = self
          ? await myAttendance(currentYm.year, currentYm.month)
          : await staffDashboard(id, currentYm.year, currentYm.month);
        cache.current[keyOf(currentYm)] = d;
      } catch {}
    })();
  }, [id, self, currentYm]));

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < months.length - 1;

  const renderPage = useCallback(({ item }) => (
    <MonthPage
      staffId={id}
      self={self}
      ym={item}
      width={width}
      cachedData={cache.current[keyOf(item)]}
      onData={handlePageData}
      navigation={navigation}
      staffName={name}
    />
  ), [id, self, name, width, handlePageData, navigation]);

  const getItemLayout = useCallback((_, i) => ({ length: width, offset: width * i, index: i }), [width]);

  return (
    <View style={styles.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Green header bar */}
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </Pressable>
        <Text style={styles.barTitle}>Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Sub-bar: chart title + month nav */}
      <View style={styles.subBar}>
        <Text style={styles.chartTitle}>
          {name ? `Attendance Chart · ${name}` : 'My Attendance Chart'}
        </Text>
        <View style={styles.monthNav}>
          <Pressable onPress={() => canGoPrev && stepMonth(-1)} hitSlop={10} style={[styles.navBtn, !canGoPrev && { opacity: 0.3 }]} disabled={!canGoPrev}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.monthLbl}>{MONTHS[currentYm.month]} {currentYm.year}</Text>
            {isCurrent(currentYm) && <Text style={styles.currentPill}>Current month</Text>}
          </View>
          <Pressable onPress={() => canGoNext && stepMonth(1)} hitSlop={10} style={[styles.navBtn, !canGoNext && { opacity: 0.3 }]} disabled={!canGoNext}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </Pressable>
        </View>
        {!isCurrent(currentYm) && (
          <Pressable onPress={goToCurrent} style={styles.backBtn}>
            <Ionicons name="today-outline" size={13} color={COLORS.white} />
            <Text style={styles.backTxt}>Back to current month</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={months}
        renderItem={renderPage}
        keyExtractor={keyOf}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="start"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SP.lg, paddingBottom: SP.md, backgroundColor: '#0E9F6E',
  },
  barTitle: { ...TYPE.h2, color: COLORS.white },

  subBar: {
    paddingHorizontal: SP.lg, paddingVertical: SP.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  chartTitle: { ...TYPE.title, color: COLORS.text, textAlign: 'center', marginBottom: SP.sm },
  monthNav:   { flexDirection: 'row', alignItems: 'center', gap: SP.md },
  navBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  monthLbl:   { ...TYPE.title, fontSize: 18, color: COLORS.text, fontWeight: '800' },
  currentPill:{ fontSize: 10, color: COLORS.primary, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  backBtn:    { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, marginTop: SP.sm },
  backTxt:    { fontSize: 12, color: COLORS.white, fontWeight: '800' },

  // Table
  table:  { backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', margin: SP.lg, marginBottom: 0 },
  thead:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: COLORS.surfaceAlt },
  th:     { fontSize: 10, fontWeight: '800', color: COLORS.textSoft },
  tr:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.md, paddingVertical: 9, borderTopWidth: 1, borderTopColor: COLORS.border },

  // Column widths — tight so nothing wastes space; flex Status fills remainder
  colDate:    { width: 54 },
  colCheckin: { width: 52, marginLeft: SP.xs },
  colHrs:     { width: 46, marginLeft: SP.xs },
  colAdmin:   { width: 60, marginLeft: SP.xs },

  cell:     { justifyContent: 'center' },

  // Date two-line
  tdDate:   { fontSize: 13, fontWeight: '800', color: COLORS.text, fontVariant: ['tabular-nums'] },
  tdDay:    { fontSize: 10, fontWeight: '700', color: COLORS.textMute, marginTop: 1 },

  td:       { fontSize: 13, color: COLORS.text },
  dash:     { color: COLORS.textMute, fontSize: 13 },

  // Admin cell — icon + name stacked
  adminCell: { alignItems: 'center' },
  adminName: { fontSize: 9, fontWeight: '700', color: COLORS.primary, marginTop: 2, textAlign: 'center', maxWidth: 56 },

  // Legend
  calcTitle: { ...TYPE.title, color: COLORS.text, marginTop: SP.xl, marginBottom: SP.sm, paddingHorizontal: SP.lg },
  calc:      { backgroundColor: COLORS.surface, borderRadius: R.md, borderWidth: 1, borderColor: COLORS.border, padding: SP.md, marginHorizontal: SP.lg },
  calcRow:   { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  calcLabel: { flex: 1, ...TYPE.body, color: COLORS.textSoft },
  calcNum:   { ...TYPE.title, color: COLORS.text },
});
