import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable, Alert, Platform, FlatList, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SP, R, TYPE, SHADOW } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { getTimeline } from '../api/day';
import { staffAction, editEventTime } from '../api/admin';
import EventAddress from '../components/EventAddress';
import DateTimePicker from '@react-native-community/datetimepicker';

// Icon + color per event type
const EV = {
  checkin:    { icon: 'airplane', c: COLORS.success, label: 'Checked In', rot: '90deg' },
  atoffice:   { icon: 'business', c: '#0E7490', label: 'At Office' },
  checkout:   { icon: 'airplane', c: COLORS.danger, label: 'Checked Out', rot: '-90deg' },
  reached:    { icon: 'arrow-forward', c: COLORS.success, label: 'Reached' },
  leaving:    { icon: 'arrow-back', c: COLORS.success, label: 'Leaving' },
  wfh:        { icon: 'home', c: COLORS.primary, label: 'Work From Home' },
  remove_wfh: { icon: 'home-outline', c: COLORS.textSoft, label: 'Removed WFH' },
  lunch:      { icon: 'restaurant', c: COLORS.warn, label: 'Lunch' },
  lunch_in:   { icon: 'restaurant', c: COLORS.warn, label: 'Lunch In' },
  lunch_out:  { icon: 'fast-food-outline', c: COLORS.textSoft, label: 'Lunch Out' },
  absent:     { icon: 'close-circle', c: COLORS.danger, label: 'Absent' },
  half_day:   { icon: 'cut', c: '#7C3AED', label: 'Half Day — 0.5 leave deducted' },
  overtime:   { icon: 'time',         c: '#7C3AED',     label: 'Overtime' },
};

import { hhmm } from '../utils/timeFormat';
const fmtTotal = (m) => m ? `${Math.floor(m / 60)}h ${m % 60}m` : '—';
// Raw GPS distance for per-event display.
const fmtDist = (m) => {
  if (m == null) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} kms` : `${Math.round(m)} mts`;
};
// Total distance = raw × 1.6 to reflect actual on-ground travel (roads/turns).
const DIST_FACTOR = 1.6;
const fmtDistTotal = (m) => {
  if (m == null) return null;
  const adj = m * DIST_FACTOR;
  return adj >= 1000 ? `${(adj / 1000).toFixed(1)} kms` : `${Math.round(adj)} mts`;
};

const pad = (n) => String(n).padStart(2, '0');
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const shiftDate = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const prettyDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const WINDOW_DAYS = 60; // browse up to 60 days back — extends as needed

// Build [oldest, ..., today] so today sits at the rightmost index. Initial scroll
// starts at the rightmost page; a swipe left-to-right (finger dragging right)
// reveals older days — matches the "flip back a book page" mental model.
const buildDays = (numDays) => {
  const t = todayLocal();
  return Array.from({ length: numDays }, (_, i) => shiftDate(t, -(numDays - 1 - i)));
};

const buildSelfDial = (user) => {
  const clName = user?.compulsoryLocation?.name;
  return [
    { kind: 'checkin',        label: clName ? `Check in at ${clName}` : 'Check in',        icon: 'log-in',      c: COLORS.success },
    { kind: 'reset_checkin',  label: 'Reset check-in',  icon: 'refresh',     c: COLORS.success },
    { kind: 'checkout',       label: 'Check out',       icon: 'log-out',     c: COLORS.danger },
    { kind: 'reset_checkout', label: 'Reset check-out', icon: 'refresh',     c: COLORS.warn },
    { kind: 'mark_absent',    label: 'Mark absent',     icon: 'close-circle',c: COLORS.danger },
    { kind: 'revert_absent',  label: 'Revert absent',   icon: 'arrow-undo-circle', c: '#0284C7' },
    { kind: 'overtime',       label: 'Overtime',         icon: 'time-outline', c: '#7C3AED' },
  ];
};

// ---- Individual day page (renders inside the horizontal FlatList) ----
// Vertically scrollable. Fetches its data on first render, hangs onto it via
// the parent's cache so revisiting is instant. Rendered at exactly one screen-width
// so the horizontal FlatList can snap between pages cleanly.
function DayPage({ date, width, cachedData, onData, isAdmin, onEditEvent }) {
  const [data, setData] = useState(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDay = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const d = await getTimeline(date);
      setData(d);
      onData?.(date, d);
    } catch { /* keep old */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [date, onData]);

  useEffect(() => {
    if (!cachedData) fetchDay(false);
    // Only run on mount / date change — parent controls cache invalidation via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = data?.events || [];

  return (
    <View style={{ width }}>
      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchDay(true)} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {!loading && events.length === 0 && (
          <Text style={styles.dim}>No activity on this day.</Text>
        )}
        {events.map((e, i) => {
          const ev = EV[e.type] || (String(e.type).startsWith('ca_')
            ? { icon: e.icon || 'location-outline', c: COLORS.primary, label: e.name || 'Location' }
            : EV.checkin);
          return (
            <Animated.View key={i} entering={FadeInDown.delay(30 * i).duration(220)} style={styles.row}>
              {isAdmin && (e.type === 'checkin' || e.type === 'checkout')
                ? <Pressable onPress={() => onEditEvent({ which: e.type, when: new Date(e.at), date })} style={styles.timeCol}>
                    <Text style={[styles.time, { color: COLORS.primary }]}>{hhmm(e.at)}</Text>
                    <Ionicons name="pencil" size={11} color={COLORS.primary} style={{ marginTop: 2 }} />
                  </Pressable>
                : <View style={styles.timeCol}><Text style={styles.time}>{hhmm(e.at)}</Text></View>}
              <View style={styles.lineCol}>
                <View style={[styles.node, { backgroundColor: ev.c }]}>
                  <Ionicons name={ev.icon} size={14} color={COLORS.white} style={ev.rot ? { transform: [{ rotate: ev.rot }] } : null} />
                </View>
                {i < events.length - 1 && <View style={styles.stem} />}
              </View>
              <View style={styles.body}>
                <Text style={styles.evLabel}>{ev.label}{e.byAdmin ? '  (by admin)' : ''}</Text>
                <EventAddress address={e.address} lat={e.lat} lng={e.lng} style={styles.addr} />
                {e.distance != null && e.distance > 0 && <Text style={styles.dist}>Distance: {fmtDist(e.distance)}</Text>}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function TimelineScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [dial, setDial] = useState(false);
  const [edit, setEdit] = useState(null);
  const [width, setWidth] = useState(Dimensions.get('window').width);
  const isAdmin = user?.role === 'admin';

  // The days array — chronological (oldest first). Today is at the LAST index so the
  // list starts scrolled to the right; swipe LEFT-TO-RIGHT reveals older days.
  const days = useMemo(() => buildDays(WINDOW_DAYS), []);
  const initialIndex = days.length - 1;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentDate = days[currentIndex];
  const isToday = currentDate === todayLocal();

  // Per-date data cache — populated as each DayPage fetches. Also stores summary
  // (totalMinutes/Meters/name) so the header can show it for whichever page is on screen.
  const cache = useRef({});
  const [headerData, setHeaderData] = useState(null);
  const listRef = useRef(null);

  // Called by each DayPage once its data arrives. If it's the currently-visible day,
  // also update the header pills. Cached so the same day doesn't refetch when swiped back.
  const handlePageData = useCallback((date, data) => {
    cache.current[date] = data;
    if (date === days[currentIndex]) setHeaderData(data);
  }, [currentIndex, days]);

  // As user swipes, keep the header in sync with whichever day is centered.
  const onMomentumEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== currentIndex) {
      setCurrentIndex(idx);
      setHeaderData(cache.current[days[idx]] || null);
    }
  }, [width, currentIndex, days]);

  const goToToday = useCallback(() => {
    listRef.current?.scrollToIndex({ index: initialIndex, animated: true });
    setCurrentIndex(initialIndex);
    setHeaderData(cache.current[days[initialIndex]] || null);
  }, [days, initialIndex]);

  const stepDay = useCallback((dir) => {
    const target = Math.min(days.length - 1, Math.max(0, currentIndex + dir));
    if (target === currentIndex) return;
    listRef.current?.scrollToIndex({ index: target, animated: true });
  }, [currentIndex, days.length]);

  useFocusEffect(useCallback(() => {
    // On refocus, refetch just today so recent taps show up. Adjacent days stay cached.
    (async () => {
      try {
        const d = await getTimeline(days[initialIndex]);
        cache.current[days[initialIndex]] = d;
        if (currentIndex === initialIndex) setHeaderData(d);
      } catch {}
    })();
  }, [days, initialIndex, currentIndex]));

  const saveTime = async (when) => {
    const hh = String(when.getHours()).padStart(2, '0');
    const mm = String(when.getMinutes()).padStart(2, '0');
    try {
      await editEventTime(user.id, edit.which, edit.date, `${hh}:${mm}`);
      // Refetch that day and update cache + header.
      const d = await getTimeline(edit.date);
      cache.current[edit.date] = d;
      if (edit.date === days[currentIndex]) setHeaderData(d);
      setEdit(null);
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Could not update'); }
  };

  const runSelf = (kind, label) => {
    setDial(false);
    Alert.alert(label, `${label} for yourself?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        try {
          await staffAction(user.id, kind);
          // refresh today's page
          const d = await getTimeline(days[initialIndex]);
          cache.current[days[initialIndex]] = d;
          if (currentIndex === initialIndex) setHeaderData(d);
        } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
      } },
    ]);
  };

  const canGoNext = currentIndex < days.length - 1;
  const canGoPrev = currentIndex > 0;

  const renderPage = useCallback(({ item }) => (
    <DayPage
      date={item}
      width={width}
      cachedData={cache.current[item]}
      onData={handlePageData}
      isAdmin={isAdmin}
      onEditEvent={setEdit}
    />
  ), [width, handlePageData, isAdmin]);

  const getItemLayout = useCallback((_, i) => ({ length: width, offset: width * i, index: i }), [width]);

  return (
    <View style={styles.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => canGoPrev && stepDay(-1)} hitSlop={10} style={[styles.navBtn, !canGoPrev && { opacity: 0.3 }]} disabled={!canGoPrev}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Timeline</Text>
            <Text style={styles.sub}>{headerData?.name || user?.name}</Text>
            <Text style={styles.dateStr}>{isToday ? `Today · ${prettyDate(currentDate)}` : prettyDate(currentDate)}</Text>
          </View>
          <Pressable onPress={() => canGoNext && stepDay(1)} hitSlop={10} style={[styles.navBtn, !canGoNext && { opacity: 0.3 }]} disabled={!canGoNext}>
            <Ionicons name="chevron-forward" size={22} color={COLORS.white} />
          </Pressable>
        </View>
        <View style={styles.pillRow}>
          <View style={styles.totalPill}><Ionicons name="time-outline" size={15} color={COLORS.ink} /><Text style={styles.totalTxt}>{fmtTotal(headerData?.totalMinutes)}</Text></View>
          <View style={styles.totalPill}><Ionicons name="navigate-outline" size={15} color={COLORS.ink} /><Text style={styles.totalTxt}>{fmtDistTotal(headerData?.totalMeters) || '0 mts'}</Text></View>
        </View>
        <Pressable onPress={() => navigation.navigate('AttendanceDashboard', { self: true, name: user?.name })} style={styles.chartBtn}>
          <Ionicons name="stats-chart" size={15} color={COLORS.white} />
          <Text style={styles.chartTxt}>Attendance Chart</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.9)" />
        </Pressable>
        {!isToday && (
          <Pressable onPress={goToToday} style={styles.todayBtn}>
            <Ionicons name="today-outline" size={13} color={COLORS.white} />
            <Text style={styles.todayTxt}>Back to today</Text>
          </Pressable>
        )}
      </LinearGradient>

      <FlatList
        ref={listRef}
        data={days}
        renderItem={renderPage}
        keyExtractor={(d) => d}
        horizontal
        pagingEnabled                    // native page snapping — smooth like the OS
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        initialScrollIndex={initialIndex} // start at today (rightmost)
        getItemLayout={getItemLayout}     // required for initialScrollIndex to work reliably
        windowSize={3}                    // keep only prev/current/next mounted — memory-safe
        maxToRenderPerBatch={2}
        removeClippedSubviews
        decelerationRate="fast"
        // Snap immediately — the native scroller is what makes this feel like a phone.
        snapToInterval={width}
        snapToAlignment="start"
      />

      {isAdmin && dial && <Pressable style={styles.dialScrim} onPress={() => setDial(false)} />}
      {isAdmin && dial && buildSelfDial(user).map((d, i) => (
        <Pressable key={d.kind} onPress={() => runSelf(d.kind, d.label)} style={[styles.dialItem, { bottom: insets.bottom + 90 + (buildSelfDial(user).length - 1 - i) * 58 }, SHADOW.lift]}>
          <Text style={styles.dialLabel}>{d.label}</Text>
          <View style={[styles.dialIcon, { backgroundColor: d.c }]}><Ionicons name={d.icon} size={18} color={COLORS.white} /></View>
        </Pressable>
      ))}
      {isAdmin && (
        <Pressable onPress={() => setDial((v) => !v)} style={[styles.fab, { bottom: insets.bottom + 24 }, SHADOW.lift]}>
          <Ionicons name={dial ? 'close' : 'construct'} size={24} color={COLORS.white} />
        </Pressable>
      )}
      {edit && (
        <DateTimePicker
          value={edit.when}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            if (event.type === 'dismissed' || !selected) { setEdit(null); return; }
            saveTime(selected);
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPE.h1, color: COLORS.white },
  sub: { ...TYPE.label, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  dateStr: { ...TYPE.cap, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '700' },
  pillRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md, justifyContent: 'center' },
  totalPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  totalTxt: { ...TYPE.cap, color: COLORS.ink, fontWeight: '800' },
  chartBtn: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.pill, marginTop: SP.md },
  chartTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '800' },
  todayBtn: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, marginTop: SP.sm },
  todayTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '800' },
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
