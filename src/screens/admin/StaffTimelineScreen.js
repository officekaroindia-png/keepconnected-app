import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Platform, FlatList, Dimensions, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SP, R, TYPE, SHADOW } from '../../theme/theme';
import { staffTimeline, staffAction, editEventTime, setSelfService, setOvertime, approveWFH } from '../../api/admin';
import EventAddress from '../../components/EventAddress';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';

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
  half_day:   { icon: 'cut', c: '#7C3AED', label: 'Half Day' },
  overtime:   { icon: 'time', c: '#7C3AED', label: 'Overtime' },
};

import { hhmm } from '../../utils/timeFormat';
const fmtTotal = (m) => m ? `${Math.floor(m / 60)}h ${m % 60}m` : '—';
const fmtDist = (m) => (m == null ? null : m >= 1000 ? `${(m / 1000).toFixed(1)} kms` : `${Math.round(m)} mts`);
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
const daysBetween = (a, b) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
};

const WINDOW_DAYS = 60;
const buildDays = (numDays) => {
  const t = todayLocal();
  return Array.from({ length: numDays }, (_, i) => shiftDate(t, -(numDays - 1 - i)));
};

const buildDial = (compulsoryLocation, headerData) => {
  const clName = compulsoryLocation?.name;
  const selfOn = !!headerData?.selfServiceApproved;
  const isHalf = headerData?.status === 'half_day';
  const hasCheckIn = !!headerData?.checkIn;
  // Half-day tool: "Remove" whenever it's already a half-day; otherwise "Mark",
  // but only once the person has actually checked in (no check-in → hidden).
  const halfTool = isHalf
    ? { kind: 'remove_half_day', label: 'Remove half day', short: 'Un-half',  icon: 'contract-outline', c: '#7C3AED' }
    : (hasCheckIn ? { kind: 'mark_half_day', label: 'Mark half day', short: 'Half day', icon: 'cut', c: '#7C3AED' } : null);
  return [
    { kind: 'checkin',        label: clName ? `Check in at ${clName}` : 'Check in', short: 'Check in', icon: 'log-in',           c: COLORS.success },
    { kind: 'reset_checkin',  label: 'Reset check-in',   short: 'Reset in',  icon: 'refresh',          c: COLORS.success },
    { kind: 'checkout',       label: 'Check out',        short: 'Check out', icon: 'log-out',          c: COLORS.danger },
    { kind: 'reset_checkout', label: 'Reset check-out',  short: 'Reset out', icon: 'refresh',          c: COLORS.warn },
    { kind: 'mark_absent',    label: 'Mark absent',      short: 'Absent',    icon: 'close-circle',     c: COLORS.danger },
    { kind: 'revert_absent',  label: 'Revert absent',    short: 'Un-absent', icon: 'arrow-undo-circle',c: '#0284C7' },
    ...(halfTool ? [halfTool] : []),
    { kind: 'overtime',       label: headerData?.overtime ? 'Remove overtime' : 'Overtime', short: headerData?.overtime ? 'End OT' : 'Overtime', icon: 'time-outline', c: '#7C3AED' },
    selfOn
      ? { kind: 'self_off', label: 'Revoke self check-in/out', short: 'Self off', icon: 'lock-closed', c: '#64748B' }
      : { kind: 'self_on',  label: 'Allow self check-in/out',  short: 'Self on',  icon: 'hand-left',   c: '#0891B2' },
    { kind: 'set_auto_checkout', label: 'Set auto-checkout time', short: 'Auto-out', icon: 'alarm', c: '#0891B2' },
    ...(headerData?.wfhPending ? [
      { kind: 'approve_wfh', label: 'Approve WFH', short: 'OK WFH', icon: 'checkmark-circle', c: COLORS.success },
      { kind: 'reject_wfh',  label: 'Reject WFH',  short: 'No WFH', icon: 'close-circle',     c: COLORS.danger  },
    ] : []),
  ];
};

// ---- Individual day page — data is owned by the PARENT and passed in as props ----
// This means the parent can refetch and update pageData[date] and this component
// re-renders instantly with the new events — no close/reopen needed.
function DayPage({ staffId, date, width, data, loading, refreshing, onRefresh, onEditEvent }) {
  const events = data?.events || [];
  return (
    <View style={{ width }}>
      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
        {!loading && events.length === 0 && <Text style={styles.dim}>No activity for this day.</Text>}
        {events.map((e, i) => {
          let ev = EV[e.type] || (String(e.type).startsWith('ca_')
            ? { icon: e.icon || 'location-outline', c: COLORS.primary, label: e.name || 'Location' }
            : EV.checkin);
          if (e.type === 'checkin' && e.away) ev = { icon: 'airplane', c: '#7C3AED', label: 'Away Check-in' };
          const editable = e.type === 'checkin' || e.type === 'checkout';
          return (
            <View key={i} style={styles.row}>
              <Pressable disabled={!editable} onPress={() => onEditEvent({ which: e.type, when: new Date(e.at), date })} style={styles.timeCol}>
                <Text style={[styles.time, editable && styles.timeEditable]}>{hhmm(e.at)}</Text>
                {editable && <Ionicons name="pencil" size={11} color={COLORS.primary} />}
              </Pressable>
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
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function StaffTimelineScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { id, name, date: paramDate } = route.params;
  const [dial, setDial] = useState(false);
  const [edit, setEdit] = useState(null);
  const [autoPicker, setAutoPicker] = useState(false);
  const [width, setWidth] = useState(Dimensions.get('window').width);

  const days = useMemo(() => buildDays(WINDOW_DAYS), []);
  const initialIndex = useMemo(() => {
    if (!paramDate) return days.length - 1;
    const off = daysBetween(paramDate, todayLocal());
    const idx = days.length - 1 - off;
    return Math.max(0, Math.min(days.length - 1, idx));
  }, [days, paramDate]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentDate = days[currentIndex];
  const isToday = currentDate === todayLocal();

  // ---- Parent owns ALL page data ----
  // pageData[date] = fetched data object (events, totalMinutes, etc.)
  // pageLoading[date] = bool — spinner shown on that page
  // pageRefreshing[date] = bool — pull-to-refresh indicator
  const [pageData, setPageData] = useState({});
  const [pageLoading, setPageLoading] = useState({});
  const [pageRefreshing, setPageRefreshing] = useState({});

  const listRef = useRef(null);

  // Current day's data drives the header pills
  const headerData = pageData[currentDate] || null;

  // Fetch a specific date (silent=no spinner, refresh=pull-to-refresh spinner)
  const fetchDate = useCallback(async (date, opts = {}) => {
    const { silent = false, refresh = false } = opts;
    if (!silent && !refresh) setPageLoading((prev) => ({ ...prev, [date]: true }));
    if (refresh) setPageRefreshing((prev) => ({ ...prev, [date]: true }));
    try {
      const d = await staffTimeline(id, date);
      setPageData((prev) => ({ ...prev, [date]: d }));
    } catch { /* keep whatever we had */ }
    finally {
      setPageLoading((prev) => ({ ...prev, [date]: false }));
      setPageRefreshing((prev) => ({ ...prev, [date]: false }));
    }
  }, [id]);

  // Load adjacent pages lazily as the user swipes
  const ensureFetched = useCallback((date) => {
    if (!pageData[date] && !pageLoading[date]) fetchDate(date);
  }, [pageData, pageLoading, fetchDate]);

  // Bootstrap: load the initial page + neighbours
  useEffect(() => {
    fetchDate(days[initialIndex]);
    if (days[initialIndex - 1]) fetchDate(days[initialIndex - 1]);
    if (days[initialIndex + 1]) fetchDate(days[initialIndex + 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch current page on screen focus (so navigating back shows fresh data)
  useFocusEffect(useCallback(() => {
    fetchDate(currentDate, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]));

  const onMomentumEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== currentIndex) {
      setCurrentIndex(idx);
      // Pre-load neighbours
      if (days[idx - 1]) ensureFetched(days[idx - 1]);
      if (days[idx])     ensureFetched(days[idx]);
      if (days[idx + 1]) ensureFetched(days[idx + 1]);
    }
  }, [width, currentIndex, days, ensureFetched]);

  const goToToday = useCallback(() => {
    const idx = days.length - 1;
    listRef.current?.scrollToIndex({ index: idx, animated: true });
    setCurrentIndex(idx);
  }, [days]);

  const stepDay = useCallback((dir) => {
    const target = Math.min(days.length - 1, Math.max(0, currentIndex + dir));
    if (target === currentIndex) return;
    listRef.current?.scrollToIndex({ index: target, animated: true });
  }, [currentIndex, days.length]);

  // ---- After any admin action: refetch the current date silently ----
  // Because pageData is parent state, setting it re-renders DayPage immediately.
  const refreshCurrentDay = useCallback(async () => {
    await fetchDate(currentDate, { silent: true });
  }, [currentDate, fetchDate]);

  // ---- Edit check-in / check-out time (pencil tap) ----
  const saveTime = async (when) => {
    const hh = String(when.getHours()).padStart(2, '0');
    const mm = String(when.getMinutes()).padStart(2, '0');
    try {
      await editEventTime(id, edit.which, edit.date, `${hh}:${mm}`);
      setEdit(null);
      // Confirm toast-style then refresh
      Alert.alert(
        '✓ Time updated',
        `${edit.which === 'checkin' ? 'Check-in' : 'Check-out'} time changed to ${hh}:${mm} for ${name}.`,
        [{ text: 'OK' }]
      );
      await fetchDate(edit.date, { silent: true });
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update time');
    }
  };

  const applySelfService = async (body) => {
    try {
      await setSelfService(id, { date: currentDate, ...body });
      await refreshCurrentDay();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed');
    }
  };

  // ---- FAB dial actions — every one has a confirmation Alert ----
  const runAction = (kind, label) => {
    setDial(false);

    if (kind === 'checkin') {
      Alert.alert('Check in', `Check in ${name} now on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check in', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `${name} has been checked in.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'reset_checkin') {
      Alert.alert('Reset check-in', `Remove the check-in record for ${name} on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `Check-in has been reset for ${name}.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'checkout') {
      Alert.alert('Check out', `Check out ${name} now on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check out', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `${name} has been checked out.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'reset_checkout') {
      Alert.alert('Reset check-out', `Remove the check-out record for ${name} on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `Check-out has been reset for ${name}.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'mark_absent') {
      Alert.alert('Mark absent', `Mark ${name} as absent on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark absent', style: 'destructive', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `${name} has been marked absent.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'revert_absent') {
      Alert.alert('Revert absent', `Remove the absent mark for ${name} on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revert', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `Absent mark removed for ${name}.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'mark_half_day') {
      Alert.alert('Mark half day', `Mark ${name} as a half-day on this day? Two half-days deduct one leave.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark half day', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `${name} has been marked as a half-day.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'remove_half_day') {
      Alert.alert('Remove half day', `Remove the half-day mark for ${name} on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await staffAction(id, kind, currentDate);
            Alert.alert('✓ Done', `Half-day removed for ${name}.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'overtime') {
      const turnOn = !headerData?.overtime;
      const shiftEnd = headerData?.compulsoryLocation != null ? null : null; // resolved on server
      Alert.alert(
        turnOn ? 'Mark overtime' : 'Remove overtime',
        turnOn
          ? `Allow ${name} to check out later than their shift end on this day? They will be able to check out themselves, and will be auto-checked out after the overtime window.`
          : `Remove overtime for ${name}? Self check-out permission and the extended auto-checkout will be revoked.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: async () => {
            try {
              await setOvertime(id, turnOn, currentDate);
              Alert.alert(
                '✓ Done',
                turnOn
                  ? `Overtime marked for ${name}. They can now check out themselves after their shift ends.`
                  : `Overtime removed for ${name}.`,
                [{ text: 'OK' }]
              );
              await refreshCurrentDay();
            } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
          }},
        ]
      );
      return;
    }

    if (kind === 'self_on') {
      Alert.alert('Allow self check-in/out', `Allow ${name} to self check-in/out on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Allow', onPress: async () => {
          await applySelfService({ approved: true });
          Alert.alert('✓ Done', `Self check-in/out allowed for ${name}.`, [{ text: 'OK' }]);
        }},
      ]);
      return;
    }

    if (kind === 'self_off') {
      Alert.alert('Revoke self check-in/out', `Revoke self check-in/out permission for ${name} on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: async () => {
          await applySelfService({ approved: false });
          Alert.alert('✓ Done', `Self check-in/out revoked for ${name}.`, [{ text: 'OK' }]);
        }},
      ]);
      return;
    }

    if (kind === 'approve_wfh') {
      Alert.alert('Approve WFH', `Approve Work From Home for ${name} on this day? Their full shift hours will be credited.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: async () => {
          try {
            await approveWFH(id, currentDate, true);
            Alert.alert('✓ Approved', `WFH approved for ${name}. Full shift hours credited.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'reject_wfh') {
      Alert.alert('Reject WFH', `Reject Work From Home for ${name} on this day? They will be marked absent.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => {
          try {
            await approveWFH(id, currentDate, false);
            Alert.alert('✓ Rejected', `WFH rejected for ${name}. Marked absent.`, [{ text: 'OK' }]);
            await refreshCurrentDay();
          } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Failed'); }
        }},
      ]);
      return;
    }

    if (kind === 'set_auto_checkout') {
      Alert.alert('Set auto-checkout', `Set an automatic checkout time for ${name} on this day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set time', onPress: () => setAutoPicker(true) },
      ]);
      return;
    }
  };

  const canGoNext = currentIndex < days.length - 1;
  const canGoPrev = currentIndex > 0;

  const renderPage = useCallback(({ item }) => (
    <DayPage
      staffId={id}
      date={item}
      width={width}
      data={pageData[item]}
      loading={!!pageLoading[item]}
      refreshing={!!pageRefreshing[item]}
      onRefresh={() => fetchDate(item, { refresh: true })}
      onEditEvent={setEdit}
    />
  ), [id, width, pageData, pageLoading, pageRefreshing, fetchDate]);

  const getItemLayout = useCallback((_, i) => ({ length: width, offset: width * i, index: i }), [width]);

  return (
    <View style={styles.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <LinearGradient colors={[COLORS.ink, COLORS.primaryDeep]} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </Pressable>
          <Text style={styles.title}>Timeline · {name}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.headerRow}>
          <Pressable onPress={() => canGoPrev && stepDay(-1)} hitSlop={10} style={[styles.navBtn, !canGoPrev && { opacity: 0.3 }]} disabled={!canGoPrev}>
            <Ionicons name="chevron-back" size={18} color={COLORS.white} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.dateStr}>{isToday ? `Today · ${prettyDate(currentDate)}` : prettyDate(currentDate)}</Text>
          </View>
          <Pressable onPress={() => canGoNext && stepDay(1)} hitSlop={10} style={[styles.navBtn, !canGoNext && { opacity: 0.3 }]} disabled={!canGoNext}>
            <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
          </Pressable>
        </View>
        <View style={styles.pillRow}>
          <View style={styles.totalPill}><Ionicons name="time-outline" size={15} color={COLORS.ink} /><Text style={styles.totalTxt}>{fmtTotal(headerData?.totalMinutes)}</Text></View>
          <View style={styles.totalPill}><Ionicons name="navigate-outline" size={15} color={COLORS.ink} /><Text style={styles.totalTxt}>{fmtDistTotal(headerData?.totalMeters) || '0 mts'}</Text></View>
        </View>
        {headerData?.selfServiceApproved && (
          <View style={styles.selfBanner}>
            <Ionicons name="hand-left" size={13} color="#67E8F9" />
            <Text style={styles.selfBannerTxt}>
              Self check-in/out allowed{typeof headerData.autoCheckoutMinute === 'number'
                ? ` · auto-checkout ${String(Math.floor(headerData.autoCheckoutMinute / 60)).padStart(2, '0')}:${String(headerData.autoCheckoutMinute % 60).padStart(2, '0')}`
                : ''}
            </Text>
          </View>
        )}
        {headerData?.offsiteAuthToday && (
          <View style={styles.offsiteBanner}>
            <Ionicons name="map" size={13} color="#67E8F9" />
            <Text style={styles.selfBannerTxt}>Offsite authorization today · check-in from anywhere · no away count</Text>
          </View>
        )}
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
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={false}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="start"
      />

      {dial && (
        <>
          {/* Backdrop: blur + a dark dim so the timeline text behind can't bleed
              through and mix with the panel. Tap anywhere outside to close. */}
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          <Pressable style={[StyleSheet.absoluteFillObject, styles.dimBackdrop]} onPress={() => setDial(false)} />

          {/* Compact 2-row tool sheet anchored to the bottom */}
          <View style={[styles.toolSheet, { paddingBottom: insets.bottom + 16 }, SHADOW.lift]}>
            <View style={styles.grabber} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Day tools</Text>
              <Pressable onPress={() => setDial(false)} hitSlop={8} style={styles.sheetClose}>
                <Ionicons name="close" size={18} color={COLORS.textSoft} />
              </Pressable>
            </View>
            {(() => {
              const tools = buildDial(headerData?.compulsoryLocation, headerData);
              const cols = Math.max(1, Math.ceil(tools.length / 2)); // split evenly across 2 rows
              return (
                <View style={styles.toolGrid}>
                  {tools.map((d) => (
                    <Pressable
                      key={d.kind}
                      onPress={() => runAction(d.kind, d.label)}
                      style={({ pressed }) => [styles.toolTile, { width: `${100 / cols}%` }, pressed && { opacity: 0.6 }]}
                    >
                      <View style={[styles.toolIcon, { backgroundColor: d.c }]}>
                        <Ionicons name={d.icon} size={20} color={COLORS.white} />
                      </View>
                      <Text style={styles.toolLabel} numberOfLines={2}>{d.short || d.label}</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })()}
          </View>
        </>
      )}

      {/* FAB — opens the tool sheet. Hidden while the sheet is open (the sheet has
          its own close button + tap-outside-to-close). */}
      {!dial && (
        <Pressable onPress={() => setDial(true)} style={[styles.fab, { bottom: insets.bottom + 24 }, SHADOW.lift]}>
          <Ionicons name="construct" size={24} color={COLORS.white} />
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
      {autoPicker && (
        <DateTimePicker
          value={(() => { const dt = new Date(); const m = headerData?.autoCheckoutMinute; if (typeof m === 'number') dt.setHours(Math.floor(m / 60), m % 60, 0, 0); else dt.setHours(18, 0, 0, 0); return dt; })()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={async (event, selected) => {
            setAutoPicker(false);
            if (event.type === 'dismissed' || !selected) return;
            const mins = selected.getHours() * 60 + selected.getMinutes();
            const hh = String(selected.getHours()).padStart(2, '0');
            const mm = String(selected.getMinutes()).padStart(2, '0');
            try {
              await setSelfService(id, { date: currentDate, approved: true, autoCheckoutMinute: mins });
              Alert.alert('✓ Done', `Auto-checkout set to ${hh}:${mm} for ${name}.`, [{ text: 'OK' }]);
              await refreshCurrentDay();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to set auto-checkout');
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...TYPE.h2, color: COLORS.white },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: SP.md },
  navBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  dateStr: { ...TYPE.cap, color: 'rgba(255,255,255,0.9)', fontWeight: '800' },
  pillRow: { flexDirection: 'row', gap: SP.sm, marginTop: SP.md, justifyContent: 'center' },
  totalPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  totalTxt: { ...TYPE.cap, color: COLORS.ink, fontWeight: '800' },
  todayBtn: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, marginTop: SP.sm },
  todayTxt: { ...TYPE.cap, color: COLORS.white, fontWeight: '800' },
  selfBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: SP.sm, backgroundColor: 'rgba(8,145,178,0.25)', borderWidth: 1, borderColor: 'rgba(103,232,249,0.4)', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 },
  offsiteBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: SP.sm, backgroundColor: 'rgba(20,184,166,0.25)', borderWidth: 1, borderColor: 'rgba(103,232,249,0.4)', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 },
  selfBannerTxt: { ...TYPE.cap, fontSize: 11, color: '#CFFAFE', fontWeight: '700' },
  dim: { ...TYPE.body, color: COLORS.textMute, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', gap: SP.sm },
  timeCol: { width: 58, paddingTop: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  time: { ...TYPE.label, color: COLORS.text, fontWeight: '800' },
  timeEditable: { color: COLORS.primary, textDecorationLine: 'underline' },
  lineCol: { alignItems: 'center', width: 30 },
  node: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stem: { flex: 1, width: 3, backgroundColor: COLORS.border, marginVertical: 2, minHeight: 20 },
  body: { flex: 1, paddingBottom: SP.lg },
  evLabel: { ...TYPE.title, color: COLORS.text },
  addr: { ...TYPE.body, color: COLORS.textSoft, marginTop: 2, lineHeight: 19 },
  dist: { ...TYPE.cap, color: COLORS.primary, marginTop: 2 },
  fab: { position: 'absolute', right: SP.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  // ── Tool sheet (redesigned 2-row panel) ──
  dimBackdrop: { backgroundColor: 'rgba(9,17,33,0.55)' },
  toolSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingHorizontal: SP.md },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SP.sm },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 2 },
  sheetTitle: { ...TYPE.h2, fontSize: 16, color: COLORS.text },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: SP.xs },
  toolTile: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
  toolIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  toolLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSoft, textAlign: 'center', lineHeight: 13 },
  dialItem: { position: 'absolute', right: SP.lg, flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  dialLabel: { ...TYPE.cap, color: COLORS.white, backgroundColor: 'rgba(15,23,42,0.82)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.sm, overflow: 'hidden', fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  dialIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

});
